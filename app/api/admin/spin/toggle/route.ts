// app/api/admin/spin/toggle/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { validateAdminAuth } from '../../middleware';
import { connectToDatabase, SpinSettings, AdminAuditLog, Profile } from '@/app/lib/models';

export async function POST(request: NextRequest) {
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
    const adminUser = await Profile.findOne({ email: authResult.email }).select('_id');

    const { activate } = await request.json();

    let spinSettings = await SpinSettings.findOne({});
    
    if (!spinSettings) {
      spinSettings = new SpinSettings({
        is_active: activate,
        activation_mode: 'manual',
        last_activated_by: adminUser._id.toString(),
        last_activated_at: new Date()
      });
    } else {
      spinSettings.is_active = activate;
      spinSettings.activation_mode = 'manual';
      spinSettings.last_activated_by = adminUser._id.toString();
      spinSettings.last_activated_at = new Date();
    }

    await spinSettings.save();

    // Log audit
    await AdminAuditLog.create({
      actor_id: adminUser._id.toString(),
      action: activate ? 'ACTIVATE_SPIN_WHEEL' : 'DEACTIVATE_SPIN_WHEEL',
      target_type: 'SpinSettings',
      target_id: spinSettings._id.toString(),
      resource_type: 'spin_settings',
      resource_id: spinSettings._id.toString(),
      action_type: activate ? 'spin_wheel_activated' : 'spin_wheel_deactivated',
      changes: { is_active: activate, activation_mode: 'manual' }
    });

    return NextResponse.json({
      success: true,
      message: activate ? 'Spin wheel activated' : 'Spin wheel deactivated'
    });
  } catch (error) {
    console.error('Toggle error:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
