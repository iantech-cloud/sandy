import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/app/lib/models';
import { Profile, ActivationPayment } from '@/app/lib/models';

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

    // Build query
    const query: Record<string, any> = {};

    if (status) {
      query.status = status;
    }

    // Fetch paginated transactions
    const transactions = await ActivationPayment.find(query)
      .select(
        'user_id phone_number amount status paid_at checkout_request_id createdAt'
      )
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Get total count
    const total = await ActivationPayment.countDocuments(query);

    // Get summary statistics
    const stats = await ActivationPayment.aggregate([
      {
        $facet: {
          total: [
            {
              $group: {
                _id: null,
                totalAmount: { $sum: '$amount' },
                count: { $sum: 1 },
              },
            },
          ],
          completed: [
            { $match: { status: 'completed' } },
            {
              $group: {
                _id: null,
                completedAmount: { $sum: '$amount' },
                count: { $sum: 1 },
              },
            },
          ],
          pending: [
            { $match: { status: 'pending' } },
            { $count: 'count' },
          ],
          failed: [
            { $match: { status: 'failed' } },
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
          transactions,
          pagination: {
            total,
            page,
            limit,
            pages: Math.ceil(total / limit),
          },
          stats: {
            totalAmount: statsData.total?.[0]?.totalAmount || 0,
            totalTransactions: statsData.total?.[0]?.count || 0,
            completedAmount: statsData.completed?.[0]?.completedAmount || 0,
            completedCount: statsData.completed?.[0]?.count || 0,
            pendingCount: statsData.pending?.[0]?.count || 0,
            failedCount: statsData.failed?.[0]?.count || 0,
          },
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Admin] Transactions API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
}
