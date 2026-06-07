/**
 * GET /api/support/referrals
 * Returns referral summary for the authenticated user only
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { connectToDatabase, Profile, Referral } from '@/app/lib/models';
import { AuditLogger } from '@/app/lib/services/audit-logger';

export async function GET(request: NextRequest) {
  try {
    const session = await auth().catch(() => null);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    await connectToDatabase();

    const user = await Profile.findById(userId)
      .select('referral_id balance_cents total_earnings_cents')
      .lean();

    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const u = user as any;
    const referralCode = u.referral_id || null;

    // Count direct referrals where this user is the referrer
    const totalReferrals = await Referral.countDocuments({ referrer_id: userId });

    // Sum earnings from referrals
    const earningsAgg = await Referral.aggregate([
      { $match: { referrer_id: userId } },
      { $group: { _id: null, total: { $sum: '$earning_cents' } } },
    ]);
    const totalEarnings = earningsAgg[0]?.total || 0;

    const auditLogger = new AuditLogger();
    await auditLogger.logAccessEvent({
      type: 'support_referral_view',
      user_id: userId,
      accessed_data: ['referral_code', 'referral_count', 'referral_earnings'],
      timestamp: new Date(),
    });

    return NextResponse.json({
      success: true,
      data: {
        referral_code: referralCode,
        referral_link: referralCode
          ? `${process.env.NEXT_PUBLIC_BASE_URL}/auth/sign-up?ref=${referralCode}`
          : null,
        total_referrals: totalReferrals,
        total_earnings_kes: (totalEarnings / 100).toFixed(2),
      },
    });
  } catch (error) {
    console.error('[Support/Referrals]', error);
    return NextResponse.json({ success: false, error: 'Unable to fetch referral data' }, { status: 500 });
  }
}
