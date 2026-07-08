import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, Profile } from '@/app/lib/models';

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
    const search = request.nextUrl.searchParams.get('search') || '';
    const role = request.nextUrl.searchParams.get('role') || '';
    const status = request.nextUrl.searchParams.get('status') || '';
    const skip = (page - 1) * limit;

    const query: Record<string, any> = {};

    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    if (role) {
      query.role = role;
    }

    if (status) {
      query.status = status;
    }

    // Fetch paginated users
    const users = await Profile.find(query)
      .select('_id username email role status created_at account_balance')
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Get total count
    const total = await Profile.countDocuments(query);

    // Get statistics
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

    return NextResponse.json(
      {
        success: true,
        data: {
          users: users.map((user: any) => ({
            _id: user._id?.toString(),
            username: user.username,
            email: user.email,
            role: user.role || 'user',
            status: user.status || 'active',
            created_at: user.created_at,
            account_balance: user.account_balance || 0,
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
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Admin] Users API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}
