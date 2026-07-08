import { NextRequest, NextResponse } from 'next/server';
import { validateAdminAuth } from '../../middleware';
import { connectToDatabase, Profile, AdminAuditLog } from '@/app/lib/models';

export async function POST(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
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

    const { action } = await req.json();
    const userId = params.userId;

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { success: false, message: 'Invalid action' },
        { status: 400 }
      );
    }

    const user = await Profile.findById(userId);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      );
    }

    if (action === 'approve') {
      user.is_approved = true;
      user.is_verified = true;
      await user.save();

      // Log audit
      await AdminAuditLog.create({
        actor_id: authResult.userId,
        action: 'APPROVE_USER',
        target_type: 'User',
        target_id: userId,
        resource_type: 'user',
        resource_id: userId,
        action_type: 'approve',
        changes: { is_approved: true, is_verified: true }
      });

      return NextResponse.json({
        success: true,
        message: `User ${user.email} approved successfully`,
      });
    } else {
      user.is_approved = false;
      await user.save();

      // Log audit
      await AdminAuditLog.create({
        actor_id: authResult.userId,
        action: 'REJECT_USER',
        target_type: 'User',
        target_id: userId,
        resource_type: 'user',
        resource_id: userId,
        action_type: 'reject',
        changes: { is_approved: false }
      });

      return NextResponse.json({
        success: true,
        message: `User ${user.email} rejected`,
      });
    }
  } catch (error: any) {
    console.error('[v0] Approvals action error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to process approval' },
      { status: 500 }
    );
  }
}
