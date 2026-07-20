'use server';

import { connectToDatabase, Profile, Referral, Transaction, ChatForeignersTransaction } from '../lib/models';
import { auth } from '@/auth'; 
import { Session } from '@auth/core/types';

// Type definitions
interface ReferredUserData {
  _id: any;
  username?: string;
  email?: string;
  status?: string;
  created_at?: Date;
  level?: number;
  rank?: string;
  total_earnings_cents?: number;
  balance_cents?: number;
  tasks_completed?: number;
  activation_status?: string;
}

interface ReferralDocument {
  _id: any;
  referrer_id: any;
  referred_id: ReferredUserData;
  created_at: Date;
  referral_bonus_paid?: boolean;
  referral_bonus_amount_cents?: number;
}

interface TransactionDocument {
  _id: any;
  user_id: any;
  type: string;
  amount_cents: number;
  metadata?: {
    referredUser?: string;
    level?: number;
  };
}interface ReferralItem {
  id: string;
  name: string;
  email: string;
  joinDate?: Date;
  status: string;
  earnings: number;
  level: number;
  rank: string;
  tasksCompleted: number;
  totalEarnings: number;
  activationStatus: string;
  referralCount: number;
}

interface ReferralsResponse {
  success: boolean;
  data?: ReferralItem[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  message: string;
}

interface CommissionStats {
  level1: { 
    totalEarnings: number; 
    count: number;
  };
  level2: {
    totalEarnings: number;
    count: number;
  };
  total: number;
}

interface CommissionStatsResponse {
  success: boolean;
  data?: CommissionStats;
  message: string;
}

// Session type guard
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

export async function getReferrals(filters?: {
  page?: number;
  limit?: number;
  status?: string;
}): Promise<ReferralsResponse> {
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

    const page = filters?.page || 1;
    const limit = filters?.limit || 10; // Database-level pagination
    const skip = (page - 1) * limit;

    const query: any = { referrer_id: currentUser._id.toString() };
    if (filters?.status && filters.status !== 'all') {
      query['referred_id.status'] = filters.status;
    }

    // Fetch referrals without populate (referred_id is String, not ObjectId)
    const userReferrals = await (Referral as any)
      .find(query)
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
      .exec();

    // Manual Profile lookup for referred users
    const referredIds = userReferrals.map((r: any) => r.referred_id);
    const profiles = await (Profile as any)
      .find({ _id: { $in: referredIds } })
      .select('username email status created_at is_verified activation_paid_at')
      .lean();
    
    const profileMap = new Map(profiles.map((p: any) => [p._id.toString(), p]));

    const totalCount = await (Referral as any).countDocuments(query);

    // Get referral earnings from LEGACY Transaction collection
    // Referral bonuses are stored here (not in ChatForeignersTransaction)
    const referralTransactions = await (Transaction as any)
      .find({
        user_id: currentUser._id,
        type: 'REFERRAL',
        status: 'completed'
      })
      .select('amount_cents metadata')
      .lean()
      .exec();

    // Build earnings map keyed by referred user ID string.
    // activation.ts stores both referred_user_id and referredUser in metadata — check both.
    const earningsMap = new Map<string, number>();
    (referralTransactions as TransactionDocument[]).forEach((tx) => {
      const refId = (tx.metadata?.referred_user_id || tx.metadata?.referredUser)?.toString();
      if (refId) {
        earningsMap.set(refId, (earningsMap.get(refId) || 0) + tx.amount_cents);
      }
    });

    // Build referral counts for all referred users in a single aggregation
    const referralCountsMap = new Map<string, number>();
    if (referredIds.length > 0) {
      const referralCounts = await (Referral as any).aggregate([
        { $match: { referrer_id: { $in: referredIds } } },
        { $group: { _id: '$referrer_id', count: { $sum: 1 } } }
      ]);
      referralCounts.forEach((item: any) => {
        referralCountsMap.set(item._id.toString(), item.count);
      });
    }

    // Transform — use profileMap to get user data
    const transformedReferrals: ReferralItem[] = (userReferrals as ReferralDocument[]).map((ref) => {
      const userId = ref.referred_id;
      const referredUser = profileMap.get(userId);
      const earnings = earningsMap.get(userId) || 0;
      // is_verified is set to true when the user pays the activation fee
      const activationStatus = referredUser?.is_verified || referredUser?.activation_paid_at
        ? 'activated'
        : 'not_activated';

      return {
        id: ref._id.toString(),
        name: referredUser?.username || 'Unknown User',
        email: referredUser?.email || 'No email',
        joinDate: referredUser?.created_at,
        status: referredUser?.status || 'inactive',
        earnings: earnings / 100,
        level: 1,
        rank: 'Bronze',
        tasksCompleted: 0,
        totalEarnings: 0,
        activationStatus,
        referralCount: referralCountsMap.get(userId) || 0
      };
    });

    return {
      success: true,
      data: transformedReferrals,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      },
      message: 'Referrals fetched successfully'
    };

  } catch (error) {
    console.error('Get referrals error:', error);
    return { 
      success: false, 
      message: 'Failed to fetch referrals' 
    };
  }
}

export async function getReferralCommissionStats(): Promise<CommissionStatsResponse> {
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

    // Get all completed REFERRAL transactions earned by this user from the LEGACY Transaction
    // collection — that is where referral bonuses (activation + CF unlock) are recorded.
    const allReferralTransactions = await (Transaction as any).find({
      user_id: currentUser._id,
      type: 'REFERRAL',
      status: 'completed'
    }).select('amount_cents metadata').lean();

    // Level 1 = metadata.level === 1 OR metadata.level is absent (legacy records before 2-tier)
    const l1Txns = (allReferralTransactions as TransactionDocument[]).filter(
      (tx) => !tx.metadata?.level || tx.metadata.level === 1
    );
    const l2Txns = (allReferralTransactions as TransactionDocument[]).filter(
      (tx) => tx.metadata?.level === 2
    );

    const l1Earnings = l1Txns.reduce((sum, tx) => sum + tx.amount_cents, 0);
    const l2Earnings = l2Txns.reduce((sum, tx) => sum + tx.amount_cents, 0);

    const stats: CommissionStats = {
      level1: {
        totalEarnings: l1Earnings / 100,
        count: l1Txns.length
      },
      level2: {
        totalEarnings: l2Earnings / 100,
        count: l2Txns.length
      },
      total: (l1Earnings + l2Earnings) / 100
    };

    return {
      success: true,
      data: stats,
      message: 'Commission stats fetched successfully'
    };

  } catch (error) {
    console.error('Get commission stats error:', error);
    return { 
      success: false, 
      message: 'Failed to fetch commission statistics' 
    };
  }
}

export async function getReferralSummary(): Promise<{
  success: boolean;
  data?: {
    totalReferrals: number;
    activeReferrals: number;
    totalEarnings: number;
    pendingEarnings: number;
  };
  message: string;
}> {
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

    // Get total referrals count
    const totalReferrals = await (Referral as any).countDocuments({ 
      referrer_id: currentUser._id.toString()
    });

    // Get active referrals count - need to fetch and check manually since referred_id is String
    const allReferrals = await (Referral as any)
      .find({ referrer_id: currentUser._id.toString() })
      .select('referred_id')
      .lean();
    
    const referredIds = allReferrals.map((r: any) => r.referred_id);
    const activeProfiles = await (Profile as any)
      .find({ _id: { $in: referredIds }, status: 'active' })
      .countDocuments();
    
    const activeReferrals = activeProfiles;

    // Get total referral earnings from Transaction collection (not ChatForeignersTransaction)
    const earningsResult = await (Transaction as any).aggregate([
      {
        $match: {
          user_id: currentUser._id,
          type: 'REFERRAL',
          status: 'completed'
        }
      },
      {
        $group: {
          _id: null,
          totalEarnings: { $sum: '$amount_cents' }
        }
      }
    ]);

    // Get pending referral earnings from Transaction collection
    const pendingEarningsResult = await (Transaction as any).aggregate([
      {
        $match: {
          user_id: currentUser._id,
          type: 'REFERRAL',
          status: 'pending'
        }
      },
      {
        $group: {
          _id: null,
          pendingEarnings: { $sum: '$amount_cents' }
        }
      }
    ]);

    const totalEarnings = earningsResult[0]?.totalEarnings || 0;
    const pendingEarnings = pendingEarningsResult[0]?.pendingEarnings || 0;

    return {
      success: true,
      data: {
        totalReferrals,
        activeReferrals,
        totalEarnings: totalEarnings / 100,
        pendingEarnings: pendingEarnings / 100
      },
      message: 'Referral summary fetched successfully'
    };

  } catch (error) {
    console.error('Get referral summary error:', error);
    return { 
      success: false, 
      message: 'Failed to fetch referral summary' 
    };
  }
}

export async function getReferralInfo(): Promise<{
  success: boolean;
  data?: {
    referralCode: string;
    referralLink: string;
  };
  message: string;
}> {
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

    // Use referral_id from the profile schema (e.g., "SANDY001")
    const referralCode = currentUser.referral_id;
    
    if (!referralCode) {
      return { 
        success: false, 
        message: 'Referral code not found for user' 
      };
    }

    const referralLink = `${process.env.NEXTAUTH_URL}/auth/sign-up?ref=${referralCode}`;

    return {
      success: true,
      data: {
        referralCode,
        referralLink
      },
      message: 'Referral info fetched successfully'
    };

  } catch (error) {
    console.error('Get referral info error:', error);
    return { 
      success: false, 
      message: 'Failed to fetch referral information' 
    };
  }
}

/**
 * Check if user qualifies for KES 500 bonus and apply it
 * Requirements:
 * 1. User must be activated (is_active = true)
 * 2. User must have referred at least 5 people
 * 3. User must not have already received the bonus
 */
export async function checkAndApplyReferralBonus(): Promise<{
  success: boolean;
  message: string;
  referralCount?: number;
  bonusApplied?: boolean;
}> {
  try {
    const session = await auth();
    
    if (!isValidSession(session)) {
      return { success: false, message: 'Unauthorized' };
    }

    await connectToDatabase();
    
    const currentUser = await (Profile as any).findOne({ 
      email: session.user.email 
    }).lean();

    if (!currentUser) {
      return { success: false, message: 'User not found' };
    }

    console.log('[v0] Checking bonus eligibility for:', currentUser.email);

    // Count referrals
    const referralCount = await (Referral as any).countDocuments({
      referrer_id: currentUser._id,
    });

    console.log('[v0] User has', referralCount, 'referrals');

    // Check eligibility criteria
    const isActivated = currentUser.is_active === true;
    const hasEnoughReferrals = referralCount >= 5;
    const bonusAlreadyApplied = currentUser.metadata?.referral_bonus_applied === true;

    console.log('[v0] Bonus eligibility:', {
      isActivated,
      hasEnoughReferrals,
      bonusAlreadyApplied,
    });

    // If user doesn't qualify, return their progress
    if (!isActivated || !hasEnoughReferrals || bonusAlreadyApplied) {
      return {
        success: false,
        message: bonusAlreadyApplied 
          ? 'Bonus already applied'
          : !isActivated
          ? 'Account not activated'
          : 'Not enough referrals yet',
        referralCount,
        bonusApplied: false,
      };
    }

    // User qualifies! Apply the bonus
    const bonusAmount = 50000; // KES 500 in cents

    console.log('[v0] Applying KES 500 bonus to user:', currentUser.email);

    // Update user profile to mark bonus as applied
    await (Profile as any).updateOne(
      { _id: currentUser._id },
      {
        $set: {
          'metadata.referral_bonus_applied': true,
          'metadata.referral_bonus_applied_at': new Date(),
        },
      }
    );

    // Create transaction record for the bonus
    await (Transaction as any).create({
      user_id: currentUser._id,
      type: 'BONUS',
      amount_cents: bonusAmount,
      description: 'Referral bonus: 5+ referrals + account activation',
      status: 'completed',
      metadata: {
        bonus_type: 'referral_activation',
        referral_count: referralCount,
      },
      created_at: new Date(),
    });

    console.log('[v0] Bonus applied successfully!');

    return {
      success: true,
      message: 'KES 500 bonus applied successfully!',
      referralCount,
      bonusApplied: true,
    };
  } catch (error) {
    console.error('[v0] Error checking/applying bonus:', error);
    return {
      success: false,
      message: 'Error processing bonus',
    };
  }
}
