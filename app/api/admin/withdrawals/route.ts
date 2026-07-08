import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/app/lib/models';
import { Profile } from '@/app/lib/models';
import mongoose from 'mongoose';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id || (session.user.role !== 'admin' && session.user.role !== 'super_admin')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    await connectToDatabase();

    const page = parseInt(request.nextUrl.searchParams.get('page') || '1');
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '20');
    const status = request.nextUrl.searchParams.get('status') || '';
    const skip = (page - 1) * limit;

    // Get Withdrawal model from mongoose
    const WithdrawalModel = mongoose.models['Withdrawal'];
    if (!WithdrawalModel) {
      return NextResponse.json(
        { error: 'Withdrawal model not found' },
        { status: 500 }
      );
    }

    // Build query
    const query: Record<string, any> = {};
    if (status) {
      query.status = status;
    }

    // Fetch withdrawals with user details
    const withdrawals = await WithdrawalModel.find(query)
      .select('user_id amount_cents status requested_at completed_at bank_account createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Populate user info
    const enrichedWithdrawals = await Promise.all(
      withdrawals.map(async (w: any) => {
        const user = await Profile.findById(w.user_id)
          .select('username email phone_number')
          .lean();
        return {
          id: w._id?.toString(),
          user_id: w.user_id?.toString(),
          username: user?.username || 'Unknown',
          email: user?.email || 'N/A',
          amount: (w.amount_cents || 0) / 100,
          amount_cents: w.amount_cents || 0,
          status: w.status || 'pending',
          bank_account: w.bank_account || 'N/A',
          requested_at: w.requested_at || w.createdAt,
          completed_at: w.completed_at || null,
        };
      })
    );

    // Get total count
    const total = await WithdrawalModel.countDocuments(query);

    // Get summary statistics
    const stats = await WithdrawalModel.aggregate([
      {
        $facet: {
          total: [
            {
              $group: {
                _id: null,
                totalAmount: { $sum: '$amount_cents' },
                count: { $sum: 1 },
              },
            },
          ],
          completed: [
            { $match: { status: 'completed' } },
            {
              $group: {
                _id: null,
                completedAmount: { $sum: '$amount_cents' },
                count: { $sum: 1 },
              },
            },
          ],
          pending: [
            { $match: { status: 'pending' } },
            { $count: 'count' },
          ],
        },
      },
    ]);

    const statsData = stats[0] || {};

    return NextResponse.json(
      {
        success: true,
        data: {
          withdrawals: enrichedWithdrawals,
          pagination: {
            total,
            page,
            limit,
            pages: Math.ceil(total / limit),
          },
          stats: {
            totalAmount: (statsData.total?.[0]?.totalAmount || 0) / 100,
            totalWithdrawals: statsData.total?.[0]?.count || 0,
            completedAmount: (statsData.completed?.[0]?.completedAmount || 0) / 100,
            completedCount: statsData.completed?.[0]?.count || 0,
            pendingCount: statsData.pending?.[0]?.count || 0,
          },
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Admin] Withdrawals API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch withdrawals' },
      { status: 500 }
    );
  }
}
