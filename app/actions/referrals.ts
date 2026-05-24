'use server';

import { connectToDatabase, Profile, Referral, Transaction } from '../lib/models';
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
}

interface ReferralItem {
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

    const query: any = { referrer_id: currentUser._id };
    if (filters?.status && filters.status !== 'all') {
      query['referred_id.status'] = filters.status;
    }

    // Optimized query: only select needed fields and use database-level pagination
    const userReferrals = await (Referral as any)
      .find(query)
      .populate('referred_id', 'username email status created_at activation_status') // Reduced fields
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
      .exec();

    const totalCount = await (Referral as any).countDocuments(query);

    // Get referral earnings - only selected fields, single query
    const referralTransactions = await (Transaction as any)
      .find({
        user_id: currentUser._id,
        type: 'REFERRAL',
        status: 'completed'
      })
      .select('amount_cents metadata.referredUser') // Only needed fields
      .lean()
      .exec();

    // Get referral counts for all referred users in one query
      const referralCountsMap = new Map();
      if (userReferrals.length > 0) {
        const referredIds = userReferrals
          .map(ref => ref.referred_id?._id)
          .filter(Boolean);

        const referralCounts = await (Referral as any)
          .aggregate([
            { $match: { referrer_id: { $in: referredIds } } },
            { $group: { _id: '$referrer_id', count: { $sum: 1 } } }
          ]);

        referralCounts.forEach((item: any) => {
          referralCountsMap.set(item._id.toString(), item.count);
        });
      }

      // Get referral payments (KSH 70 = 7000 cents) to determine activation
      const referralPayments = await (Transaction as any)
        .find({
          type: 'REFERRAL',
          status: 'completed',
          amount_cents: 7000 // KSH 70 activation payment
        })
        .select('metadata.referredUser')
        .lean()
        .exec();

      const activatedUserIds = new Set(
        referralPayments
          .map((p: any) => p.metadata?.referredUser?.toString())
          .filter(Boolean)
      );

    // Transform data for frontend - no async operations needed
    const transformedReferrals: ReferralItem[] = (userReferrals as ReferralDocument[]).map((ref) => {
      const referredUser = ref.referred_id;
      const userId = referredUser?._id?.toString();
      
      const earnings = (referralTransactions as TransactionDocument[])
        .filter(tx => tx.metadata?.referredUser === userId)
        .reduce((sum, tx) => sum + tx.amount_cents, 0);

      // Activation status: yes if user has paid KSH 70, otherwise no
      const isActivated = activatedUserIds.has(userId) ? 'activated' : 'not_activated';

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
        activationStatus: isActivated,
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

    console.log('[v0] Fetching referral commission stats for:', currentUser.username);

    // Get direct referral commissions (KES 70 each)
    // Query transactions where user_id is the EARNER (referrer) and type is REFERRAL
    const directReferralTransactions = await (Transaction as any).find({
      user_id: currentUser._id,
      type: 'REFERRAL',
      status: 'completed'
    }).lean();

    console.log('[v0] Found referral transactions:', {
      count: directReferralTransactions.length,
      transactions: directReferralTransactions.map((tx: any) => ({
        amount: tx.amount_cents / 100,
        level: tx.metadata?.level,
        description: tx.description
      }))
    });

    const level1Earnings = directReferralTransactions.reduce((sum: number, tx: any) => sum + tx.amount_cents, 0);
    const level1Count = directReferralTransactions.length;

    const stats: CommissionStats = {
      level1: {
        totalEarnings: level1Earnings,
        count: level1Count
      },
      total: level1Earnings
    };

    console.log('[v0] Commission stats:', {
      totalEarnings: level1Earnings / 100,
      count: level1Count
    });

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
      referrer_id: currentUser._id 
    });

    // Get active referrals count
    const activeReferrals = await (Referral as any).countDocuments({
      referrer_id: currentUser._id,
      'referred_id.status': 'active'
    });

    // Get total referral earnings
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

    // Get pending referral earnings
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
