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
    }).populate('referred_id', 'username email status created_at activation_status firstName lastName').lean();

    // Get all completed REFERRAL transactions for this user (no metadata level filter)
    const allReferralTxns = await (Transaction as any).find({
      user_id: currentUser._id,
      type: 'REFERRAL',
      status: 'completed'
    }).select('amount_cents metadata').lean();

    // Level 1 = level absent (legacy) OR level === 1
    const l1Transactions = allReferralTxns.filter((tx: any) => !tx.metadata?.level || tx.metadata.level === 1);
    const l2Transactions = allReferralTxns.filter((tx: any) => tx.metadata?.level === 2);

    const level1Earnings = l1Transactions.reduce((sum: number, tx: any) => sum + tx.amount_cents, 0) / 100;
    const level2Earnings = l2Transactions.reduce((sum: number, tx: any) => sum + tx.amount_cents, 0) / 100;

    console.log(`[v0] Referral earnings for ${currentUser.username}:`, {
      l1Count: l1Transactions.length,
      l1Earnings: level1Earnings,
      l2Count: l2Transactions.length,
      l2Earnings: level2Earnings,
    });

    // Count active referrals (where referred user's status is 'active' or 'verified')
    const activeReferrals = directReferrals.filter((ref: any) => 
      ref.referred_id?.status === 'active' || ref.referred_id?.status === 'verified'
    ).length;

    // Count referrals with activated accounts (activation_status === 'activated')
    const activatedReferrals = directReferrals.filter((ref: any) => 
      ref.referred_id?.activation_status === 'activated'
    ).length;

    // Build referral items with commission details
    const referralItems = directReferrals.map((ref: any) => ({
      id: ref._id.toString(),
      name: `${ref.referred_id?.firstName || ''} ${ref.referred_id?.lastName || ''}`.trim() || ref.referred_id?.username || 'Unknown',
      email: ref.referred_id?.email || 'N/A',
      joinDate: ref.referred_id?.created_at,
      status: ref.referred_id?.status || 'pending',
      activationStatus: ref.referred_id?.activation_status || 'pending',
      bonusPaid: ref.referral_bonus_paid || false,
      bonusAmount: (ref.referral_bonus_amount_cents || 0) / 100,
      commission: 65 // KES 65 per level 1 activation referral
    }));

    return {
      success: true,
      data: {
        referralLink,
        referralCode: currentUser.referral_id,
        totalReferrals: directReferrals.length,
        activeReferrals,
        activatedReferrals,
        level1Earnings,
        level2Earnings,
        totalEarnings: level1Earnings + level2Earnings,
        referralItems,
        commissionStructure: {
          activation: {
            level1: 65, // KES 65 per direct referral activation
            level2: 10, // KES 10 per grandparent referral activation
            company: 20 // KES 20 company fee per activation (95 - 65 - 10)
          },
          chatForeigners: {
            level1: 70, // KES 70 per L1 CF chat unlock
            level2: 10, // KES 10 per L2 CF chat unlock
            company: 20 // KES 20 company fee per CF unlock (100 - 70 - 10)
          }
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
