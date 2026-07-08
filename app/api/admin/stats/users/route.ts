import { NextRequest, NextResponse } from 'next/server';
import { validateAdminAuth } from '../../middleware';
import { connectToDatabase, Profile } from '@/app/lib/models';

export async function GET(req: NextRequest) {
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

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);

    // Calculate user metrics from actual data
    const [
      totalUsers,
      verifiedUsers,
      activeUsers,
      bannedUsers,
      todayRegistrations,
      thisMonthRegistrations,
      pendingApprovals,
      unapprovedUsers,
      usersWithVerification,
      verificationPending,
    ] = await Promise.all([
      Profile.countDocuments(),
      Profile.countDocuments({ is_verified: true }),
      Profile.countDocuments({ last_login: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }),
      Profile.countDocuments({ status: 'banned' }),
      Profile.countDocuments({ created_at: { $gte: today } }),
      Profile.countDocuments({ created_at: { $gte: thisMonth } }),
      Profile.countDocuments({ is_approved: false }),
      Profile.countDocuments({ is_verified: false }),
      Profile.countDocuments({ is_verified: true }),
      Profile.countDocuments({ verification_status: 'pending' }),
    ]);

    const verificationRate = totalUsers > 0 ? Math.round((verifiedUsers / totalUsers) * 100) : 0;
    const approvalRate = totalUsers > 0 ? Math.round(((totalUsers - pendingApprovals) / totalUsers) * 100) : 0;
    const churnThisMonth = thisMonthRegistrations - activeUsers > 0 ? thisMonthRegistrations - activeUsers : 0;

    return NextResponse.json({
      success: true,
      data: {
        overview: {
          totalUsers,
          activeToday: activeUsers,
          verifiedCount: verifiedUsers,
          bannedCount: bannedUsers,
        },
        registrations: {
          today: todayRegistrations,
          thisMonth: thisMonthRegistrations,
        },
        approvals: {
          pending: pendingApprovals,
          verified: verifiedUsers,
          unverified: unapprovedUsers,
          verificationPending: verificationPending,
        },
        metrics: {
          verificationRate: `${verificationRate}%`,
          approvalRate: `${approvalRate}%`,
          churnThisMonth,
          retentionRate: thisMonthRegistrations > 0 ? `${100 - Math.round((churnThisMonth / thisMonthRegistrations) * 100)}%` : 'N/A',
        },
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('[v0] User stats error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to calculate user stats' },
      { status: 500 }
    );
  }
}
