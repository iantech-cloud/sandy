/**
 * GET /api/support/withdrawals
 * Returns withdrawal summary for the authenticated user only
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { connectToDatabase, Profile } from '@/app/lib/models';
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
      .select('balance_cents total_withdrawals_cents status is_verified is_active preferred_mpesa_number mpesa_number_verified')
      .lean();

    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const auditLogger = new AuditLogger();
    await auditLogger.logAccessEvent({
      type: 'support_withdrawal_view',
      user_id: userId,
      accessed_data: ['balance', 'withdrawal_totals'],
      timestamp: new Date(),
    });

    const u = user as any;
    const balance_kes = (u.balance_cents || 0) / 100;
    const total_withdrawn_kes = (u.total_withdrawals_cents || 0) / 100;
    const min_withdrawal_kes = 500;

    return NextResponse.json({
      success: true,
      data: {
        balance_kes: balance_kes.toFixed(2),
        total_withdrawn_kes: total_withdrawn_kes.toFixed(2),
        can_withdraw: u.is_active && u.is_verified && balance_kes >= min_withdrawal_kes,
        min_withdrawal_kes,
        mpesa_linked: !!u.preferred_mpesa_number,
        mpesa_verified: u.mpesa_number_verified || false,
        issues: [
          !u.is_active && 'Account not activated',
          !u.is_verified && 'Account not verified',
          balance_kes < min_withdrawal_kes && `Minimum balance of KES ${min_withdrawal_kes} required`,
        ].filter(Boolean),
      },
    });
  } catch (error) {
    console.error('[Support/Withdrawals]', error);
    return NextResponse.json({ success: false, error: 'Unable to fetch withdrawal data' }, { status: 500 });
  }
}
