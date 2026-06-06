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
    }).lean();

    const totalEarnings = allReferralTransactions.reduce((sum, tx) => sum + tx.amount_cents, 0);
    const count = allReferralTransactions.length;

    const stats = {
      level1: {
        totalEarnings: totalEarnings / 100,
        count,
      },
      total: totalEarnings / 100,
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
