// app/api/referrals/commission-stats/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { connectToDatabase, Profile, Transaction } from '@/app/lib/models';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    const currentUser = await Profile.findOne({ email: session.user.email });
    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get all completed REFERRAL transactions earned by this user
    const allReferralTransactions = await Transaction.find({
      user_id: currentUser._id,
      type: 'REFERRAL',
      status: 'completed',
    }).select('amount_cents metadata').lean();

    // Level 1 = metadata.level === 1 OR absent (legacy before 2-tier)
    const l1Txns = allReferralTransactions.filter((tx: any) => !tx.metadata?.level || tx.metadata.level === 1);
    const l2Txns = allReferralTransactions.filter((tx: any) => tx.metadata?.level === 2);

    const l1Earnings = l1Txns.reduce((sum: number, tx: any) => sum + tx.amount_cents, 0);
    const l2Earnings = l2Txns.reduce((sum: number, tx: any) => sum + tx.amount_cents, 0);

    const stats = {
      level1: {
        totalEarnings: l1Earnings / 100,
        count: l1Txns.length,
      },
      level2: {
        totalEarnings: l2Earnings / 100,
        count: l2Txns.length,
      },
      total: (l1Earnings + l2Earnings) / 100,
    };

    return NextResponse.json({
      success: true,
      data: stats,
    });

  } catch (error) {
    console.error('Commission stats error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
