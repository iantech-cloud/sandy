/**
 * GET /api/support/profile
 * Returns sanitized profile info for the authenticated user only
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
      .select('-password -twoFASecret -twoFABackupCodes -antiPhishingCode')
      .lean();

    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const auditLogger = new AuditLogger();
    await auditLogger.logAccessEvent({
      type: 'support_profile_view',
      user_id: userId,
      accessed_data: ['profile'],
      timestamp: new Date(),
    });

    // Return only safe fields
    const safe = {
      username: (user as any).username,
      email: (user as any).email,
      status: (user as any).status,
      role: (user as any).role,
      is_verified: (user as any).is_verified,
      is_active: (user as any).is_active,
      kyc_status: (user as any).kyc_status,
      created_at: (user as any).created_at,
      profile_completed: (user as any).profile_completed,
    };

    return NextResponse.json({ success: true, data: safe });
  } catch (error) {
    console.error('[Support/Profile]', error);
    return NextResponse.json({ success: false, error: 'Unable to fetch profile' }, { status: 500 });
  }
}
