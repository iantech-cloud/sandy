import { NextRequest, NextResponse } from 'next/server';
import { validateAdminAuth, validatePaginationParams, buildPaginationMeta } from '../middleware';
import { connectToDatabase, Profile } from '@/app/lib/models';

export async function GET(req: NextRequest) {
  try {
    // Validate admin access
    const authResult = await validateAdminAuth();
    if (!authResult.authorized) {
      return NextResponse.json(
        { success: false, message: authResult.error },
        { status: authResult.status || 401 }
      );
    }

    await connectToDatabase();

    // Parse query parameters
    const { searchParams } = new URL(req.url);
    const page = searchParams.get('page') || '1';
    const limit = searchParams.get('limit') || '10';
    const search = searchParams.get('search');
    const role = searchParams.get('role');
    const status = searchParams.get('status');
    const verified = searchParams.get('verified');

    const { skip, limit: parsedLimit } = validatePaginationParams(page, limit);

    // Build filter
    const filter: any = {};

    if (search) {
      filter.$or = [
        { email: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
      ];
    }

    if (role && role !== 'all') {
      filter.role = role;
    }

    if (status && status !== 'all') {
      filter.status = status;
    }

    if (verified && verified !== 'all') {
      filter.is_verified = verified === 'true';
    }

    // Get total count
    const total = await Profile.countDocuments(filter);

    // Fetch paginated users
    const users = await Profile.find(filter)
      .select('_id email username name role status is_verified is_approved created_at last_login')
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(parsedLimit)
      .lean();

    const pagination = buildPaginationMeta(parseInt(page), parsedLimit, total);

    return NextResponse.json({
      success: true,
      data: {
        users: users.map((u: any) => ({
          ...u,
          _id: u._id?.toString(),
          created_at: u.created_at?.toISOString(),
          last_login: u.last_login?.toISOString(),
        })),
        pagination,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[v0] Admin users API error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to fetch users' },
      { status: 500 }
    );
  }
}
