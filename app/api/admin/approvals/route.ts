import { NextRequest, NextResponse } from 'next/server';
import { validateAdminAuth, validatePaginationParams, buildPaginationMeta } from '../middleware';
import { connectToDatabase, Profile, UserSession } from '@/app/lib/models';

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
    const status = searchParams.get('status') || 'pending';
    const search = searchParams.get('search');

    const { skip, limit: parsedLimit } = validatePaginationParams(page, limit);

    // Build filter
    const filter: any = {};

    if (status && status !== 'all') {
      if (status === 'pending') {
        filter.is_approved = false;
        filter.is_verified = false;
      } else if (status === 'verified') {
        filter.is_verified = true;
        filter.is_approved = false;
      } else if (status === 'approved') {
        filter.is_approved = true;
      }
    }

    if (search) {
      filter.$or = [
        { email: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
      ];
    }

    // Get total count
    const total = await Profile.countDocuments(filter);

    // Fetch paginated submissions
    const submissions = await Profile.find(filter)
      .select('_id email username name role is_verified is_approved created_at updated_at')
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(parsedLimit)
      .lean();

    const pagination = buildPaginationMeta(parseInt(page), parsedLimit, total);

    return NextResponse.json({
      success: true,
      data: {
        submissions: submissions.map((u: any) => ({
          ...u,
          _id: u._id?.toString(),
          created_at: u.created_at?.toISOString(),
          updated_at: u.updated_at?.toISOString(),
        })),
        pagination,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[v0] Admin approvals API error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to fetch approvals' },
      { status: 500 }
    );
  }
}
