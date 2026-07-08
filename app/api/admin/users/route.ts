import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, Profile } from '@/app/lib/models';
import {
  checkAdminAuth,
  applyAdminRateLimit,
  validatePagination,
  buildQuery,
  adminResponse,
  adminError,
  logAdminAction,
} from '@/app/lib/admin-middleware';

export async function GET(request: NextRequest) {
  try {
    // 1. Admin authorization check
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

    // 4. Validate pagination
    const pageParam = request.nextUrl.searchParams.get('page');
    const limitParam = request.nextUrl.searchParams.get('limit');
    const { page, limit, skip } = validatePagination(pageParam, limitParam);

    // 5. Build query with safe filters
    const search = request.nextUrl.searchParams.get('search') || '';
    const role = request.nextUrl.searchParams.get('role') || '';
    const status = request.nextUrl.searchParams.get('status') || '';

    const query = buildQuery({ search, role, status });

    // 6. Fetch paginated users with lean query
    const users = await Profile.find(query)
      .select('_id username email role status created_at last_login account_balance')
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // 7. Get total count for pagination
    const total = await Profile.countDocuments(query);

    // 8. Get statistics using aggregation for correctness
    const stats = await Profile.aggregate([
      {
        $facet: {
          total: [{ $count: 'count' }],
          active: [
            { $match: { status: 'active' } },
            { $count: 'count' },
          ],
          admins: [
            { $match: { $or: [{ role: 'admin' }, { role: 'super_admin' }] } },
            { $count: 'count' },
          ],
          totalBalance: [
            { $group: { _id: null, total: { $sum: { $toDouble: '$account_balance' } } } },
          ],
        },
      },
    ]);

    const statsData = stats[0] || {};

    return adminResponse(
      {
        users: users.map((user: any) => ({
          _id: user._id?.toString(),
          username: user.username,
          email: user.email,
          role: user.role || 'user',
          status: user.status || 'active',
          created_at: user.created_at,
          last_login: user.last_login,
          account_balance: parseFloat(String(user.account_balance || 0)),
        })),
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        },
        stats: {
          totalUsers: statsData.total?.[0]?.count || 0,
          activeUsers: statsData.active?.[0]?.count || 0,
          admins: statsData.admins?.[0]?.count || 0,
          totalBalance: statsData.totalBalance?.[0]?.total || 0,
        },
      },
      200
    );
  } catch (error) {
    console.error('[Admin] Users GET error:', error);
    return adminError(
      error instanceof Error ? error.message : 'Failed to fetch users',
      500
    );
  }
}
