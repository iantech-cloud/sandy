import { auth } from '@/auth';
import { connectToDatabase, Profile } from '@/app/lib/models';

/**
 * Get current user from session
 * Attempts to find user by session ID first, then falls back to email
 */
export async function getCurrentUserFromSession() {
  try {
    const session = await auth();
    const sessionId = (session?.user as any)?.id || (session?.user as any)?.userId;

    if (!session?.user || (!sessionId && !session.user.email)) {
      return null;
    }

    await connectToDatabase();

    let currentUser = null;
    if (sessionId) {
      currentUser = await Profile.findOne({ _id: sessionId }).lean();
    }
    if (!currentUser && session.user.email) {
      const emailPattern = new RegExp(
        `^${session.user.email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
        'i'
      );
      currentUser = await Profile.findOne({ email: { $regex: emailPattern } }).lean();
    }

    return currentUser;
  } catch (error) {
    console.error('[Auth] Error getting current user:', error);
    return null;
  }
}

/**
 * Require authenticated user - throws error if not authenticated
 */
export async function requireAuthentication() {
  const user = await getCurrentUserFromSession();
  if (!user) {
    throw new Error('Authentication required');
  }
  return user;
}

/**
 * Get user ID from session
 */
export async function getUserIdFromSession(): Promise<string | null> {
  try {
    const session = await auth();
    const sessionId = (session?.user as any)?.id || (session?.user as any)?.userId;
    return sessionId || null;
  } catch {
    return null;
  }
}
