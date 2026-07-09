import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { connectToDatabase, Profile } from '@/app/lib/models';
import mongoose from 'mongoose';

export async function POST(request: NextRequest) {
  try {
    // 1. Authentication & authorization
    const session = await auth();
    if (!session?.user?.id || !['admin', 'super_admin'].includes(session.user.role)) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 403 }
      );
    }

    // 2. Validate request body
    const body = await request.json();
    const { withdrawalId, reason } = body;

    if (!withdrawalId || !reason || reason.trim().length < 10) {
      return NextResponse.json(
        { success: false, message: 'Withdrawal ID and rejection reason (min 10 chars) are required' },
        { status: 400 }
      );
    }

    // 3. Database connection
    await connectToDatabase();

    // 4. Get Withdrawal model
    const Withdrawal = mongoose.models['Withdrawal'];
    if (!Withdrawal) {
      return NextResponse.json(
        { success: false, message: 'Withdrawal model not found' },
        { status: 500 }
      );
    }

    // 5. Find withdrawal
    const withdrawal = await Withdrawal.findById(withdrawalId);
    if (!withdrawal) {
      return NextResponse.json(
        { success: false, message: 'Withdrawal not found' },
        { status: 404 }
      );
    }

    // 6. Check status
    if (withdrawal.status !== 'pending') {
      return NextResponse.json(
        { success: false, message: `Cannot reject withdrawal with status: ${withdrawal.status}` },
        { status: 400 }
      );
    }

    // 7. Get user and refund balance
    const user = await Profile.findById(withdrawal.user_id);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      );
    }

    const balanceBefore = user.balance_cents || 0;
    user.balance_cents = (user.balance_cents || 0) + withdrawal.amount_cents;
    await user.save();

    // 8. Update withdrawal
    withdrawal.status = 'rejected';
    withdrawal.approved_by = session.user.id;
    withdrawal.approved_at = new Date();
    withdrawal.failure_reason = reason;
    withdrawal.user_balance_before = balanceBefore;
    withdrawal.user_balance_after = user.balance_cents;
    await withdrawal.save();

    // 9. Get Transaction model and create refund transaction
    const Transaction = mongoose.models['Transaction'] || mongoose.model('Transaction', {
      user_id: mongoose.Schema.Types.ObjectId,
      amount_cents: Number,
      type: String,
      description: String,
      status: String,
      balance_before_cents: Number,
      balance_after_cents: Number,
      source: String,
      admin_processed: Boolean,
      admin_processed_by: mongoose.Schema.Types.ObjectId,
      admin_processed_at: Date,
      metadata: mongoose.Schema.Types.Mixed,
      createdAt: { type: Date, default: Date.now },
    });

    await Transaction.create({
      user_id: withdrawal.user_id,
      amount_cents: withdrawal.amount_cents,
      type: 'WITHDRAWAL_REFUND',
      description: `Refund for rejected withdrawal - ${reason}`,
      status: 'completed',
      balance_before_cents: balanceBefore,
      balance_after_cents: user.balance_cents,
      source: 'admin',
      admin_processed: true,
      admin_processed_by: session.user.id,
      admin_processed_at: new Date(),
      metadata: {
        withdrawal_id: withdrawalId,
        rejection_reason: reason,
        refunded: true,
      },
    });

    // 10. Create audit log
    const AuditLog = mongoose.models['AdminAuditLog'] || mongoose.model('AdminAuditLog', {
      actor_id: String,
      action: String,
      target_type: String,
      target_id: String,
      changes: mongoose.Schema.Types.Mixed,
      metadata: mongoose.Schema.Types.Mixed,
      timestamps: true,
    });

    await AuditLog.create({
      actor_id: session.user.id,
      action: 'REJECT_WITHDRAWAL',
      target_type: 'Withdrawal',
      target_id: withdrawalId,
      changes: {
        status: { from: 'pending', to: 'rejected' },
        refund_amount_cents: withdrawal.amount_cents,
        reason,
      },
      metadata: {
        amount_cents: withdrawal.amount_cents,
        user_id: withdrawal.user_id,
        balance_refunded_to_user: user.balance_cents,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Withdrawal rejected and amount refunded to user',
        withdrawal: {
          _id: withdrawal._id,
          status: withdrawal.status,
          amount_cents: withdrawal.amount_cents,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Admin] Reject withdrawal error:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Failed to reject withdrawal' },
      { status: 500 }
    );
  }
}
