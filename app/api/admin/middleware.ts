import { auth } from '@/auth';
import { connectToDatabase, Profile } from '@/app/lib/models';

export interface AdminAuthResult {
  authorized: boolean;
  userId?: string;
  email?: string;
  role?: string;
  error?: string;
  status?: number;
}

/**
 * Validate admin request with proper error handling
 * Returns early with error details if unauthorized
 */
export async function validateAdminAuth(): Promise<AdminAuthResult> {
  try {
    const session = await auth();
    
    if (!session?.user?.email) {
      return {
        authorized: false,
        error: 'Unauthorized: No session found',
        status: 401,
      };
    }

    await connectToDatabase();

    const user = await Profile.findOne({ email: session.user.email })
      .select('_id email role')
      .lean();

    if (!user) {
      return {
        authorized: false,
        error: 'User profile not found',
        status: 404,
      };
    }

    // Allow both admin and super_admin roles
    if (user.role !== 'admin' && user.role !== 'super_admin') {
      return {
        authorized: false,
        error: 'Forbidden: Admin access required',
        status: 403,
      };
    }

    return {
      authorized: true,
      userId: user._id?.toString(),
      email: user.email,
      role: user.role,
    };
  } catch (error) {
    console.error('[v0] Admin auth error:', error);
    return {
      authorized: false,
      error: 'Internal server error during authentication',
      status: 500,
    };
  }
}

/**
 * Validate pagination parameters
 */
export function validatePaginationParams(page?: string, limit?: string) {
  const pageNum = Math.max(1, parseInt(page || '1', 10));
  const limitNum = Math.max(1, Math.min(100, parseInt(limit || '10', 10)));
  
  return {
    page: pageNum,
    limit: limitNum,
    skip: (pageNum - 1) * limitNum,
  };
}

/**
 * Build standard pagination metadata
 */
export function buildPaginationMeta(page: number, limit: number, total: number) {
  return {
    page,
    limit,
    total,
    pages: Math.ceil(total / limit),
  };
}
