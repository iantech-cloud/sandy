import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, Profile } from '@/app/lib/models';
import {
  checkAdminAuth,
  applyAdminRateLimit,
  logAdminAction,
  validatePagination,
  adminResponse,
  adminError,
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

    // 5. Fetch pending approvals with full validation
    const filter = {
      approval_status: { $in: ['pending', 'rejected'] },
      is_verified: true,
    };

    const approvals = await Profile.find(filter)
      .select(
        '_id username email phone_number approval_status status created_at account_balance'
      )
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Profile.countDocuments(filter);

    // 6. Get breakdown of statuses
    const statusBreakdown = await Profile.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$approval_status',
          count: { $sum: 1 },
        },
      },
    ]);

    return adminResponse(
      {
        approvals: approvals.map((user: any) => ({
          _id: user._id?.toString(),
          username: user.username,
          email: user.email,
          phone_number: user.phone_number,
          status: user.approval_status,
          account_status: user.status,
          balance: user.account_balance || 0,
          created_at: user.created_at,
        })),
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        },
        stats: {
          pending: statusBreakdown.find((s: any) => s._id === 'pending')?.count || 0,
          rejected: statusBreakdown.find((s: any) => s._id === 'rejected')?.count || 0,
        },
      },
      200
    );
  } catch (error) {
    console.error('[Admin] Approvals GET error:', error);
    return adminError(
      error instanceof Error ? error.message : 'Failed to fetch approvals',
      500
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // 1. Admin authorization check (super admin only for approvals)
    const authResult = await checkAdminAuth(request);
    if (!authResult.authorized) {
      return authResult.error;
    }

    // Only super admins can approve users
    if (authResult.role !== 'super_admin') {
      await logAdminAction(
        authResult.userId,
        authResult.name || authResult.email,
        'APPROVAL_DENIED',
        'user',
        undefined,
        { reason: 'Insufficient permissions' },
        'failure'
      );
      return adminError('Super Admin required for approvals', 403);
    }

    // 2. Rate limiting
    const rateLimitResult = applyAdminRateLimit(request, authResult.userId);
    if (rateLimitResult.limited) {
      return rateLimitResult.response;
    }

    // 3. Validate request body
    const body = await request.json();
    const { userId, action } = body;

    if (!userId || !['approve', 'reject'].includes(action)) {
      return adminError('Invalid request: userId and action (approve/reject) required', 400);
    }

    // 4. Database connection
    await connectToDatabase();

    // 5. Find user to approve
    const user = await Profile.findById(userId).lean();
    if (!user) {
      await logAdminAction(
        authResult.userId,
        authResult.name || authResult.email,
        `APPROVAL_${action.toUpperCase()}`,
        'user',
        userId,
        { error: 'User not found' },
        'failure'
      );
      return adminError('User not found', 404);
    }

    // 6. Process approval with full accounting
    let updateData: any = {};

    if (action === 'approve') {
      updateData = {
        approval_status: 'approved',
        is_approved: true,
        status: 'active',
        activated_at: new Date(),
        activated_by_admin: authResult.userId,
      };
    } else if (action === 'reject') {
      updateData = {
        approval_status: 'rejected',
        is_approved: false,
        rejected_at: new Date(),
        rejected_by_admin: authResult.userId,
      };
    }

    // 7. Update user with transaction logging
    const updatedUser = await Profile.findByIdAndUpdate(userId, updateData, {
      new: true,
      lean: true,
    });

    // 8. Create audit log entry
    await logAdminAction(
      authResult.userId,
      authResult.name || authResult.email,
      `APPROVAL_${action.toUpperCase()}`,
      'user',
      userId,
      {
        previousStatus: user.approval_status,
        newStatus: action === 'approve' ? 'approved' : 'rejected',
        userEmail: user.email,
        userName: user.username,
      },
      'success'
    );

    return adminResponse(
      {
        message: `User ${action}ed successfully`,
        user: {
          _id: updatedUser._id?.toString(),
          username: updatedUser.username,
          email: updatedUser.email,
          status: updatedUser.approval_status,
        },
      },
      200
    );
  } catch (error) {
    console.error('[Admin] Approvals POST error:', error);
    return adminError(
      error instanceof Error ? error.message : 'Failed to process approval',
      500
    );
  }
}
