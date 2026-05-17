'use server';

import { connectToDatabase, Profile, Referral, Transaction } from '../lib/models';
import { auth } from '@/auth';
import { Session } from '@auth/core/types';

type SessionWithUser = Session & {
  user: {
    email: string;
    name?: string | null;
    image?: string | null;
  };
};

function isValidSession(session: Session | null): session is SessionWithUser {
  return (
    session !== null &&
    session.user !== null &&
    typeof session.user === 'object' &&
    'email' in session.user &&
    typeof session.user.email === 'string' &&
    session.user.email.length > 0
  );
}

export async function getReferralDashboardData() {
  try {
    const session = await auth();
    
    if (!isValidSession(session)) {
      return { success: false, message: 'Unauthorized' };
    }

    await connectToDatabase();
    const currentUser = await (Profile as any).findOne({ email: session.user.email });

    if (!currentUser) {
      return { success: false, message: 'User not found' };
    }

    // Get referral link
    const referralLink = `${process.env.NEXTAUTH_URL}/auth/sign-up?ref=${currentUser.referral_id}`;

    // Get direct referrals (Level 1)
    const directReferrals = await (Referral as any).find({
      referrer_id: currentUser._id
    }).populate('referred_id', 'username email status created_at activation_status').lean();

    // Get Level 1 earnings (KES 70 per direct referral)
    // Include transactions with level 1 metadata OR all REFERRAL type (backward compat)
    const level1Transactions = await (Transaction as any).find({
      user_id: currentUser._id,
      type: 'REFERRAL',
      $or: [
        { 'metadata.level': 1 },
        { 'metadata.level': { $exists: false } },
        { 'metadata.level': null }
      ]
    }).lean();

    const level1Earnings = level1Transactions.reduce((sum: number, tx: any) => sum + tx.amount_cents, 0) / 100;

    // Get Level 2 earnings (KES 10 per indirect referral) - currently not used
    const level2Transactions = await (Transaction as any).find({
      user_id: currentUser._id,
      type: 'REFERRAL',
      'metadata.level': 2
    }).lean();

    const level2Earnings = level2Transactions.reduce((sum: number, tx: any) => sum + tx.amount_cents, 0) / 100;
    
    console.log(`[v0] Referral earnings for ${currentUser.username}:`, {
      totalTransactions: level1Transactions.length + level2Transactions.length,
      level1Count: level1Transactions.length,
      level1Earnings: level1Earnings,
      level2Count: level2Transactions.length,
      level2Earnings: level2Earnings
    });

    // Count active referrals
    const activeReferrals = directReferrals.filter((ref: any) => ref.referred_id?.status === 'active').length;

    // Build referral items with commission details
    const referralItems = directReferrals.map((ref: any) => ({
      id: ref._id.toString(),
      name: ref.referred_id?.username || 'Unknown',
      email: ref.referred_id?.email || 'N/A',
      joinDate: ref.referred_id?.created_at,
      status: ref.referred_id?.status || 'pending',
      activationStatus: ref.referred_id?.activation_status || 'pending',
      bonusPaid: ref.referral_bonus_paid || false,
      bonusAmount: (ref.referral_bonus_amount_cents || 0) / 100,
      commission: 70 // KES 70 per level 1 referral (shown as regular number, not cents)
    }));

    return {
      success: true,
      data: {
        referralLink,
        referralCode: currentUser.referral_id,
        totalReferrals: directReferrals.length,
        activeReferrals,
        activatedReferralsWithBonus: directReferrals.filter((ref: any) => ref.referral_bonus_paid).length,
        level1Earnings,
        level2Earnings,
        totalEarnings: level1Earnings + level2Earnings,
        referralItems,
        commissionStructure: {
          level1: 70,  // KES 70 per direct referral
          level2: 10,  // KES 10 per indirect referral (if implemented)
          company: 20  // KES 20 company fee per activation
        }
      }
    };
  } catch (error) {
    console.error('[v0] Error fetching referral dashboard data:', error);
    return {
      success: false,
      message: 'Failed to fetch referral data'
    };
  }
}
