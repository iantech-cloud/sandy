'use server';

import { connectToDatabase, Profile, Transaction, Withdrawal, AdminAuditLog } from '@/app/lib/models';
import { protectAdminRoute } from '@/app/lib/admin/auth';
import { revalidatePath } from 'next/cache';
import bcrypt from 'bcryptjs';

/**
 * Centralized admin actions with audit logging
 */

async function logAdminAction(
  action: string,
  resourceType: string,
  resourceId: string,
  changes: any,
  session: any
) {
  try {
    const adminEmail = session?.user?.email;
    const adminId = (session?.user as any)?.id;

    await AdminAuditLog.create({
      admin_id: adminId,
      admin_email: adminEmail,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      changes,
      created_at: new Date(),
    });
  } catch (error) {
    console.error('[v0] Failed to log admin action:', error);
  }
}

/**
 * Approve a user account
 */
export async function approveUser(userId: string) {
  try {
    const session = await protectAdminRoute();
    await connectToDatabase();

    const user = await Profile.findByIdAndUpdate(
      userId,
      {
        is_approved: true,
        approval_status: 'approved',
        updated_at: new Date(),
      },
      { new: true }
    );

    if (!user) {
      throw new Error('User not found');
    }

    await logAdminAction(
      'APPROVE_USER',
      'User',
      userId,
      { is_approved: true, approval_status: 'approved' },
      session
    );

    revalidatePath('/admin/approvals');
    revalidatePath('/admin/users');

    return { success: true, data: user };
  } catch (error: any) {
    console.error('[v0] Error approving user:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Reject a user account
 */
export async function rejectUser(userId: string, reason: string) {
  try {
    const session = await protectAdminRoute();
    await connectToDatabase();

    const user = await Profile.findByIdAndUpdate(
      userId,
      {
        is_approved: false,
        approval_status: 'rejected',
        rejection_reason: reason,
        updated_at: new Date(),
      },
      { new: true }
    );

    if (!user) {
      throw new Error('User not found');
    }

    await logAdminAction(
      'REJECT_USER',
      'User',
      userId,
      { is_approved: false, approval_status: 'rejected', reason },
      session
    );

    revalidatePath('/admin/approvals');
    revalidatePath('/admin/users');

    return { success: true, data: user };
  } catch (error: any) {
    console.error('[v0] Error rejecting user:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Ban a user
 */
export async function banUser(userId: string, reason: string) {
  try {
    const session = await protectAdminRoute();
    await connectToDatabase();

    const user = await Profile.findByIdAndUpdate(
      userId,
      {
        status: 'banned',
        is_active: false,
        ban_reason: reason,
        banned_at: new Date(),
        updated_at: new Date(),
      },
      { new: true }
    );

    if (!user) {
      throw new Error('User not found');
    }

    await logAdminAction(
      'BAN_USER',
      'User',
      userId,
      { status: 'banned', is_active: false, reason },
      session
    );

    revalidatePath('/admin/users');

    return { success: true, data: user };
  } catch (error: any) {
    console.error('[v0] Error banning user:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Unban a user
 */
export async function unbanUser(userId: string) {
  try {
    const session = await protectAdminRoute();
    await connectToDatabase();

    const user = await Profile.findByIdAndUpdate(
      userId,
      {
        status: 'active',
        is_active: true,
        ban_reason: undefined,
        banned_at: undefined,
        updated_at: new Date(),
      },
      { new: true }
    );

    if (!user) {
      throw new Error('User not found');
    }

    await logAdminAction(
      'UNBAN_USER',
      'User',
      userId,
      { status: 'active', is_active: true },
      session
    );

    revalidatePath('/admin/users');

    return { success: true, data: user };
  } catch (error: any) {
    console.error('[v0] Error unbanning user:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Approve a withdrawal request
 */
export async function approveWithdrawal(withdrawalId: string) {
  try {
    const session = await protectAdminRoute();
    await connectToDatabase();

    const withdrawal = await Withdrawal.findByIdAndUpdate(
      withdrawalId,
      {
        status: 'approved',
        approved_at: new Date(),
        updated_at: new Date(),
      },
      { new: true }
    );

    if (!withdrawal) {
      throw new Error('Withdrawal not found');
    }

    await logAdminAction(
      'APPROVE_WITHDRAWAL',
      'Withdrawal',
      withdrawalId,
      { status: 'approved' },
      session
    );

    revalidatePath('/admin/withdrawals');

    return { success: true, data: withdrawal };
  } catch (error: any) {
    console.error('[v0] Error approving withdrawal:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Reject a withdrawal request
 */
export async function rejectWithdrawal(withdrawalId: string, reason: string) {
  try {
    const session = await protectAdminRoute();
    await connectToDatabase();

    const withdrawal = await Withdrawal.findByIdAndUpdate(
      withdrawalId,
      {
        status: 'rejected',
        rejection_reason: reason,
        updated_at: new Date(),
      },
      { new: true }
    );

    if (!withdrawal) {
      throw new Error('Withdrawal not found');
    }

    // Refund the user's wallet
    await Profile.findByIdAndUpdate(withdrawal.user_id, {
      $inc: { wallet_balance: withdrawal.amount },
    });

    await logAdminAction(
      'REJECT_WITHDRAWAL',
      'Withdrawal',
      withdrawalId,
      { status: 'rejected', reason },
      session
    );

    revalidatePath('/admin/withdrawals');

    return { success: true, data: withdrawal };
  } catch (error: any) {
    console.error('[v0] Error rejecting withdrawal:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Complete a withdrawal request
 */
export async function completeWithdrawal(withdrawalId: string, transactionRef: string) {
  try {
    const session = await protectAdminRoute();
    await connectToDatabase();

    const withdrawal = await Withdrawal.findByIdAndUpdate(
      withdrawalId,
      {
        status: 'completed',
        transaction_reference: transactionRef,
        completed_at: new Date(),
        updated_at: new Date(),
      },
      { new: true }
    );

    if (!withdrawal) {
      throw new Error('Withdrawal not found');
    }

    await logAdminAction(
      'COMPLETE_WITHDRAWAL',
      'Withdrawal',
      withdrawalId,
      { status: 'completed', transactionRef },
      session
    );

    revalidatePath('/admin/withdrawals');

    return { success: true, data: withdrawal };
  } catch (error: any) {
    console.error('[v0] Error completing withdrawal:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Reset user password (admin action)
 */
export async function resetUserPassword(userId: string, newPassword: string) {
  try {
    const session = await protectAdminRoute();
    await connectToDatabase();

    if (newPassword.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const user = await Profile.findByIdAndUpdate(
      userId,
      {
        password: hashedPassword,
        updated_at: new Date(),
      },
      { new: true }
    );

    if (!user) {
      throw new Error('User not found');
    }

    await logAdminAction(
      'RESET_PASSWORD',
      'User',
      userId,
      { password: 'reset' },
      session
    );

    revalidatePath('/admin/users');

    return { success: true, message: 'Password reset successfully' };
  } catch (error: any) {
    console.error('[v0] Error resetting password:', error);
    return { success: false, error: error.message };
  }
}
