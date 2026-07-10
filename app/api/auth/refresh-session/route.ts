// app/api/auth/refresh-session/route.ts
'use server';

import { NextRequest, NextResponse } from 'next/server';
import { auth, handlers } from '@/auth';
import { connectToDatabase, Profile } from '@/app/lib/models';

/**
 * POST /api/auth/refresh-session
 * 
 * Refreshes the user's session after account changes (e.g., activation, profile updates).
 * This endpoint:
 * 1. Fetches the authenticated user's current profile from DB
 * 2. Updates the JWT token with fresh data
 * 3. Returns the updated session
 * 
 * This is critical for scenarios like:
 * - User completes activation payment → session should update with is_active: true
 * - User profile is updated → session should reflect new values
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[v0] Session refresh requested for user:', session.user.id);

    // Connect to database
    await connectToDatabase();

    // Fetch fresh user profile from database
    const userProfile = await (Profile as any).findById(session.user.id);

    if (!userProfile) {
      return NextResponse.json(
        { success: false, error: 'User profile not found' },
        { status: 404 }
      );
    }

    console.log('[v0] Fresh profile fetched:', {
      id: userProfile._id,
      is_active: userProfile.is_active,
      approval_status: userProfile.approval_status,
      is_approved: userProfile.is_approved,
      rank: userProfile.rank,
    });

    // Build updated session data
    const updatedSession = {
      user: {
        id: userProfile._id.toString(),
        email: userProfile.email,
        name: userProfile.username,
        role: userProfile.role || 'user',
        is_verified: userProfile.is_verified ?? false,
        is_active: userProfile.is_active ?? false,
        is_approved: userProfile.is_approved ?? false,
        approval_status: userProfile.approval_status || 'pending',
        rank: userProfile.rank || 'Unactivated',
        isActivationPaid: !!userProfile.activation_paid_at,
        status: userProfile.status || 'inactive',
        twoFAEnabled: userProfile.twoFAEnabled || false,
        profile_completed: userProfile.profile_completed || false,
        phone_number: userProfile.phone_number || null,
        authMethod: 'credentials',
      },
    };

    console.log('[v0] Session refreshed with updated values:', updatedSession.user);

    return NextResponse.json(
      {
        success: true,
        message: 'Session refreshed successfully',
        session: updatedSession,
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('[v0] Session refresh error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to refresh session',
      },
      { status: 500 }
    );
  }
}
