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
    const { withdrawalId, notes } = body;

    if (!withdrawalId) {
      return NextResponse.json(
        { success: false, message: 'Withdrawal ID is required' },
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
        { success: false, message: `Cannot approve withdrawal with status: ${withdrawal.status}` },
        { status: 400 }
      );
    }

    // 7. Get admin user
    const adminUser = await Profile.findById(session.user.id).lean();
    if (!adminUser) {
      return NextResponse.json(
        { success: false, message: 'Admin user not found' },
        { status: 404 }
      );
    }

    // 8. Update withdrawal
    withdrawal.status = 'approved';
    withdrawal.approved_by = session.user.id;
    withdrawal.approved_at = new Date();
    withdrawal.processing_notes = notes || 'Approved by admin';
    await withdrawal.save();

    // 9. Create audit log
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
      action: 'APPROVE_WITHDRAWAL',
      target_type: 'Withdrawal',
      target_id: withdrawalId,
      changes: {
        status: { from: 'pending', to: 'approved' },
        approved_by: session.user.id,
      },
      metadata: {
        amount_cents: withdrawal.amount_cents,
        user_id: withdrawal.user_id,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Withdrawal approved successfully',
        withdrawal: {
          _id: withdrawal._id,
          status: withdrawal.status,
          amount_cents: withdrawal.amount_cents,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Admin] Approve withdrawal error:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Failed to approve withdrawal' },
      { status: 500 }
    );
  }
}
