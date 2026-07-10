import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/app/lib/models';
import { Profile, ActivationPayment } from '@/app/lib/models';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id || (session.user.role !== 'admin' && session.user.role !== 'super_admin')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    await connectToDatabase();

    // Get total users
    const totalUsers = await Profile.countDocuments();

    // Get active users (is_active = true)
    const activeUsers = await Profile.countDocuments({ is_active: true });

    // Get pending activations (is_active = false but is_approved = true)
    const pendingActivations = await Profile.countDocuments({
      is_active: false,
      is_approved: true,
    });

    // Get approved users (is_approved = true)
    const totalApproved = await Profile.countDocuments({ is_approved: true });

    // Calculate conversion rate
    const conversionRate =
      totalUsers > 0
        ? ((activeUsers / totalUsers) * 100).toFixed(1)
        : 0;

    return NextResponse.json(
      {
        success: true,
        stats: {
          totalUsers,
          activeUsers,
          pendingActivations,
          totalApproved,
          conversionRate,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Admin] Dashboard stats API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard statistics' },
      { status: 500 }
    );
  }
}
