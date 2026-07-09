import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, Profile, Transaction } from '@/app/lib/models';
import {
  checkAdminAuth,
  applyAdminRateLimit,
  validatePagination,
} from '@/app/lib/admin-middleware';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. Admin authorization
    const authResult = await checkAdminAuth(request);
    if (!authResult.authorized) {
      return authResult.error;
    }

    // 2. Rate limiting
    const rateLimitResult = applyAdminRateLimit(request, authResult.userId);
    if (rateLimitResult.limited) {
      return rateLimitResult.response;
    }

    // 3. Database connection
    await connectToDatabase();

    // 4. Verify user exists
    const user = await Profile.findById(params.id).lean();
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // 5. Get pagination params
    const page = parseInt(request.nextUrl.searchParams.get('page') || '1');
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '20');
    const { skip } = validatePagination(page, limit);

    // 6. Get user transactions
    const transactions = await Transaction.find({ user_id: params.id })
      .select('_id user_id type amount description status created_at')
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // 7. Get total count
    const total = await Transaction.countDocuments({ user_id: params.id });

    // 8. Get summary by type
    const summary = await Transaction.aggregate([
      { $match: { user_id: params.id } },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]);

    return NextResponse.json(
      {
        success: true,
        data: {
          userId: params.id,
          username: user.username,
          transactions: transactions.map(t => ({
            _id: t._id?.toString(),
            type: t.type,
            amount: t.amount,
            description: t.description,
            status: t.status,
            created_at: t.created_at,
          })),
          pagination: {
            total,
            page,
            limit,
            pages: Math.ceil(total / limit),
          },
          summary: summary.reduce((acc, item) => {
            acc[item._id] = {
              total: item.total,
              count: item.count,
            };
            return acc;
          }, {} as Record<string, any>),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Admin] User transactions GET error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch transactions',
      },
      { status: 500 }
    );
  }
}
