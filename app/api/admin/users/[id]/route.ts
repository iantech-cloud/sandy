import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, Profile, Transaction } from '@/app/lib/models';
import {
  checkAdminAuth,
  applyAdminRateLimit,
  adminResponse,
  adminError,
  logAdminAction,
  getUserFinancialSummary,
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

    // 4. Fetch user with full data
    const user = await Profile.findById(params.id)
      .select(
        '_id username email role status created_at account_balance approval_status is_verified'
      )
      .lean();

    if (!user) {
      return adminError('User not found', 404);
    }

    // 5. Get financial summary
    const financial = await getUserFinancialSummary(params.id);

    return adminResponse(
      {
        user: {
          _id: user._id?.toString(),
          username: user.username,
          email: user.email,
          role: user.role,
          status: user.status,
          created_at: user.created_at,
          account_balance: user.account_balance || 0,
          approval_status: user.approval_status,
          is_verified: user.is_verified,
        },
        financial,
      },
      200
    );
  } catch (error) {
    console.error('[Admin] User GET error:', error);
    return adminError(
      error instanceof Error ? error.message : 'Failed to fetch user',
      500
    );
  }
}

export async function PATCH(
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

    // 3. Validate request body
    const body = await request.json();
    const { role, status, account_balance } = body;

    // Validate role
    if (role && !['user', 'admin', 'super_admin'].includes(role)) {
      return adminError('Invalid role. Must be user, admin, or super_admin', 400);
    }

    // Validate status
    if (status && !['active', 'inactive', 'banned'].includes(status)) {
      return adminError('Invalid status. Must be active, inactive, or banned', 400);
    }

    // Validate balance if provided
    if (account_balance !== undefined && typeof account_balance !== 'number') {
      return adminError('Invalid account_balance. Must be a number', 400);
    }

    // 4. Database connection
    await connectToDatabase();

    // 5. Find user and capture old data for audit
    const oldUser = await Profile.findById(params.id).lean();
    if (!oldUser) {
      return adminError('User not found', 404);
    }

    // 6. Build update data and track changes
    const updateData: Record<string, any> = {
      updated_at: new Date(),
    };
    const changes: Record<string, any> = {};

    if (role && role !== oldUser.role) {
      updateData.role = role;
      changes.role = { from: oldUser.role, to: role };
    }

    if (status && status !== oldUser.status) {
      updateData.status = status;
      changes.status = { from: oldUser.status, to: status };
    }

    if (account_balance !== undefined && account_balance !== oldUser.account_balance) {
      updateData.account_balance = account_balance;
      changes.account_balance = {
        from: oldUser.account_balance,
        to: account_balance,
        changed_by: 'admin',
      };
    }

    // 7. Update user
    const updatedUser = await Profile.findByIdAndUpdate(params.id, updateData, {
      new: true,
      lean: true,
    });

    if (!updatedUser) {
      return adminError('Failed to update user', 500);
    }

    // 8. Log the action
    await logAdminAction(
      authResult.userId,
      authResult.name || authResult.email,
      'USER_UPDATE',
      'user',
      params.id,
      changes,
      'success'
    );

    return adminResponse(
      {
        message: 'User updated successfully',
        user: {
          _id: updatedUser._id?.toString(),
          username: updatedUser.username,
          email: updatedUser.email,
          role: updatedUser.role,
          status: updatedUser.status,
          account_balance: updatedUser.account_balance || 0,
        },
        changes,
      },
      200
    );
  } catch (error) {
    console.error('[Admin] User PATCH error:', error);
    return adminError(
      error instanceof Error ? error.message : 'Failed to update user',
      500
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. Admin authorization (super admin only)
    const authResult = await checkAdminAuth(request);
    if (!authResult.authorized) {
      return authResult.error;
    }

    if (authResult.role !== 'super_admin') {
      await logAdminAction(
        authResult.userId,
        authResult.name || authResult.email,
        'USER_DELETE_DENIED',
        'user',
        params.id,
        { reason: 'Insufficient permissions' },
        'failure'
      );
      return adminError('Super Admin required for user deletion', 403);
    }

    // 2. Rate limiting
    const rateLimitResult = applyAdminRateLimit(request, authResult.userId);
    if (rateLimitResult.limited) {
      return rateLimitResult.response;
    }

    // 3. Database connection
    await connectToDatabase();

    // 4. Find user before deletion
    const user = await Profile.findById(params.id).lean();
    if (!user) {
      return adminError('User not found', 404);
    }

    // 5. Delete user
    await Profile.findByIdAndDelete(params.id);

    // 6. Create audit log
    await logAdminAction(
      authResult.userId,
      authResult.name || authResult.email,
      'USER_DELETE',
      'user',
      params.id,
      {
        username: user.username,
        email: user.email,
        balance: user.account_balance,
      },
      'success'
    );

    return adminResponse(
      {
        message: 'User deleted successfully',
        deletedUser: {
          _id: user._id?.toString(),
          username: user.username,
          email: user.email,
        },
      },
      200
    );
  } catch (error) {
    console.error('[Admin] User DELETE error:', error);
    return adminError(
      error instanceof Error ? error.message : 'Failed to delete user',
      500
    );
  }
}
