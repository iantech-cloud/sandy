import { NextRequest, NextResponse } from 'next/server';
import { validateAdminAuth, validatePaginationParams, buildPaginationMeta } from '../middleware';
import { connectToDatabase, UserSession, Profile } from '@/app/lib/models';

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
    const filter: any = { withdrawal_amount: { $exists: true, $gt: 0 } };

    if (status && status !== 'all') {
      filter.withdrawal_status = status;
    }

    if (search) {
      const user = await Profile.findOne({
        $or: [
          { email: { $regex: search, $options: 'i' } },
          { username: { $regex: search, $options: 'i' } },
        ]
      }).select('_id');

      if (user) {
        filter.user_id = user._id;
      } else {
        return NextResponse.json({
          success: true,
          data: {
            withdrawals: [],
            pagination: buildPaginationMeta(parseInt(page), parsedLimit, 0),
          },
        });
      }
    }

    // Get total count
    const total = await UserSession.countDocuments(filter);

    // Fetch paginated withdrawals
    const withdrawals = await UserSession.find(filter)
      .populate('user_id', 'email username name')
      .sort({ updated_at: -1 })
      .skip(skip)
      .limit(parsedLimit)
      .lean();

    const pagination = buildPaginationMeta(parseInt(page), parsedLimit, total);

    return NextResponse.json({
      success: true,
      data: {
        withdrawals: withdrawals.map((w: any) => ({
          _id: w._id?.toString(),
          user: {
            _id: w.user_id?._id?.toString(),
            email: w.user_id?.email,
            username: w.user_id?.username,
            name: w.user_id?.name,
          },
          amount: w.withdrawal_amount,
          status: w.withdrawal_status,
          method: w.withdrawal_method || 'mpesa',
          recipient: w.withdrawal_recipient,
          requestedAt: w.created_at?.toISOString(),
          processedAt: w.updated_at?.toISOString(),
          notes: w.withdrawal_notes,
        })),
        pagination,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[v0] Admin withdrawals API error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to fetch withdrawals' },
      { status: 500 }
    );
  }
}
