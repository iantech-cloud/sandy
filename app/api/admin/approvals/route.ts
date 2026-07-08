import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/app/lib/models';
import { Profile } from '@/app/lib/models';

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
    const skip = (page - 1) * limit;

    // Get pending approvals
    const pendingApprovals = await Profile.find({
      approval_status: 'pending',
      is_verified: true,
    })
      .select(
        'username email phone_number is_verified approval_status rank level createdAt'
      )
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Profile.countDocuments({
      approval_status: 'pending',
      is_verified: true,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          approvals: pendingApprovals.map((user: any) => ({
            id: user._id?.toString(),
            username: user.username,
            email: user.email,
            phone_number: user.phone_number,
            status: user.approval_status,
            rank: user.rank || 'Unactivated',
            level: user.level || 0,
            created_at: user.createdAt,
          })),
          pagination: {
            total,
            page,
            limit,
            pages: Math.ceil(total / limit),
          },
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Admin] Approvals API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pending approvals' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id || session.user.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Unauthorized - Super Admin required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { userId, action } = body;

    if (!userId || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    if (action === 'approve') {
      await Profile.findByIdAndUpdate(userId, {
        approval_status: 'approved',
        is_approved: true,
        status: 'active',
      });
    } else if (action === 'reject') {
      await Profile.findByIdAndUpdate(userId, {
        approval_status: 'rejected',
        is_approved: false,
      });
    }

    return NextResponse.json(
      { success: true, message: `User ${action}d successfully` },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Admin] Approvals POST error:', error);
    return NextResponse.json(
      { error: 'Failed to process approval' },
      { status: 500 }
    );
  }
}
