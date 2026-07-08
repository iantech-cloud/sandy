import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { connectToDatabase } from '@/app/lib/mongoose';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();
    
    // Get user metrics
    const Profile = require('@/app/lib/models/Profile').default;
    const totalUsers = await Profile.countDocuments();
    const activeUsers = await Profile.countDocuments({ last_login_at: { $gte: new Date(Date.now() - 86400000) } });
    const todayRegistrations = await Profile.countDocuments({ created_at: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) } });
    const pendingApprovals = await Profile.countDocuments({ verification_status: 'pending' });

    return NextResponse.json({
      success: true,
      data: { totalUsers, activeUsers, todayRegistrations, pendingApprovals }
    });
  } catch (error: any) {
    console.error('[v0] User stats error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
