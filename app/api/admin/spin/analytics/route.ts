// app/api/admin/spin/analytics/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { validateAdminAuth } from '../../middleware';
import { connectToDatabase, SpinSettings } from '@/app/lib/models';

export async function GET(request: NextRequest) {
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

    const spinSettings = await SpinSettings.findOne({}).lean();

    return NextResponse.json({
      success: true,
      data: {
        total_spins_today: spinSettings?.total_spins_today || 0,
        total_wins_today: spinSettings?.total_wins_today || 0,
        total_revenue_today_cents: spinSettings?.total_revenue_today_cents || 0,
        total_payouts_today_cents: spinSettings?.total_payouts_today_cents || 0,
        last_reset_date: spinSettings?.last_reset_date || new Date()
      }
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
