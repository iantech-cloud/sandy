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
    const { withdrawalIds } = body;

    if (!Array.isArray(withdrawalIds) || withdrawalIds.length === 0) {
      return NextResponse.json(
        { success: false, message: 'At least one withdrawal ID is required' },
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

    // 5. Bulk approve withdrawals
    let approved = 0;
    let failed = 0;
    const errors: string[] = [];
    const totalAmount = {
      cents: 0,
    };

    for (const withdrawalId of withdrawalIds) {
      try {
        const withdrawal = await Withdrawal.findById(withdrawalId);
        
        if (!withdrawal) {
          failed++;
          errors.push(`Withdrawal ${withdrawalId} not found`);
          continue;
        }

        if (withdrawal.status !== 'pending') {
          failed++;
          errors.push(`Withdrawal ${withdrawalId} has status: ${withdrawal.status}`);
          continue;
        }

        // Update withdrawal
        withdrawal.status = 'approved';
        withdrawal.approved_by = session.user.id;
        withdrawal.approved_at = new Date();
        withdrawal.processing_notes = 'Approved via bulk action by admin';
        await withdrawal.save();

        totalAmount.cents += withdrawal.amount_cents || 0;
        approved++;
      } catch (error) {
        failed++;
        errors.push(`Error processing ${withdrawalId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // 6. Create audit log for bulk action
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
      action: 'BULK_APPROVE_WITHDRAWALS',
      target_type: 'Withdrawal',
      target_id: `bulk-${approved}`,
      changes: {
        action: 'bulk_approve',
        approved_count: approved,
        failed_count: failed,
      },
      metadata: {
        withdrawal_ids: withdrawalIds,
        total_amount_cents: totalAmount.cents,
        approved,
        failed,
      },
    });

    return NextResponse.json(
      {
        success: failed === withdrawalIds.length ? false : true,
        message: `Approved ${approved} of ${withdrawalIds.length} withdrawals${failed > 0 ? ` (${failed} failed)` : ''}`,
        approved,
        failed,
        totalAmountApproved: totalAmount.cents,
        errors: errors.length > 0 ? errors : undefined,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Admin] Bulk approve withdrawals error:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Failed to bulk approve withdrawals' },
      { status: 500 }
    );
  }
}
