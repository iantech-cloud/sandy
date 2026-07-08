'use server';

import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

/**
 * Require user to be authenticated
 * Redirects to login if not authenticated
 */
export async function requireAuth() {
  const session = await auth();
  
  if (!session?.user) {
    redirect('/auth/login');
  }
  
  return session;
}

/**
 * Check if user meets all status requirements (credentials only).
 * Redirects to the appropriate page if a requirement is not met.
 * Admins bypass all activation/approval checks.
 */
export async function checkUserStatus() {
  const session = await requireAuth();
  const user = session.user;

  // Admins bypass activation and approval requirements
  if (user.role === 'admin' || user.role === 'super_admin') {
    return session;
  }

  // Credentials users go straight to activation — no email-verification step.
  if (!user.isActivationPaid) {
    redirect('/auth/activate');
  }
  if (!user.is_approved || !user.is_active) {
    redirect('/auth/pending-approval');
  }

  return session;
}

/**
 * Require specific user role
 * Redirects to unauthorized if role doesn't match
 * Note: Admins can access both admin and dashboard routes
 */
export async function requireRole(allowedRoles: string[]) {
  const session = await requireAuth();
  const user = session.user;
  
  // Admins can bypass role checks for most routes
  if ((user.role === 'admin' || user.role === 'super_admin') && !allowedRoles.includes('user_only')) {
    return session;
  }

  if (!allowedRoles.includes(user.role)) {
    redirect('/dashboard');
  }
  
  return session;
}

/**
 * Get current user without redirects (safe for UI components)
 */
export async function getCurrentUser() {
  try {
    const session = await auth();
    return session?.user || null;
  } catch (error) {
    return null;
  }
}

/**
 * Check if user has specific role (without redirect)
 */
export async function hasRole(role: string): Promise<boolean> {
  try {
    const user = await getCurrentUser();
    return user?.role === role;
  } catch (error) {
    return false;
  }
}

/**
 * Check if user meets status requirements (without redirect)
 * Useful for conditional rendering
 * Admins always meet requirements (bypass activation/approval)
 */
export async function getUserStatus() {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return { 
        authenticated: false, 
        meetsRequirements: false,
        missingRequirements: ['authentication']
      };
    }

    const missingRequirements: string[] = [];

    // Admins always meet requirements
    if (user.role === 'admin' || user.role === 'super_admin') {
      return {
        authenticated: true,
        meetsRequirements: true,
        missingRequirements: [],
        user
      };
    }

    // Regular users - check activation and approval
    if (!user.isActivationPaid) missingRequirements.push('activation_payment');
    if (!user.is_approved || !user.is_active) missingRequirements.push('approval');

    return {
      authenticated: true,
      meetsRequirements: missingRequirements.length === 0,
      missingRequirements,
      user
    };
  } catch (error) {
    return { 
      authenticated: false, 
      meetsRequirements: false,
      missingRequirements: ['error']
    };
  }
}

/**
 * Refresh session data
 */
export async function refreshSession(path?: string) {
  if (path) {
    revalidatePath(path);
  }
  
  const session = await auth();
  return session;
}

/**
 * Check if user can access a specific path
 * Admins can access both /admin and /dashboard routes
 */
export async function canAccessPath(path: string): Promise<boolean> {
  try {
    const user = await getCurrentUser();
    
    if (!user) return false;

    // Admin routes - admins only
    if (path.startsWith('/admin')) {
      return ['admin', 'super_admin'].includes(user.role);
    }

    // Dashboard routes - regular users and admins (admins bypass activation)
    if (path.startsWith('/dashboard') || path.startsWith('/account')) {
      // Admins can always access dashboard
      if (['admin', 'super_admin'].includes(user.role)) {
        return true;
      }
      // Regular users need to meet requirements
      const status = await getUserStatus();
      return status.meetsRequirements;
    }

    // Support routes
    if (path.startsWith('/support')) {
      return ['support', 'admin', 'super_admin'].includes(user.role);
    }

    return true;
  } catch (error) {
    return false;
  }
}

// ==================== SPECIFIC ROUTE PROTECTORS ====================

/**
 * Protect dashboard routes
 */
export async function protectDashboard() {
  return await checkUserStatus();
}

/**
 * Protect admin routes with admin role requirement
 * Does not check activation/approval - admins bypass those
 */
export async function protectAdmin() {
  const session = await requireAuth();
  
  // Check role
  if (!['admin', 'super_admin'].includes(session.user.role)) {
    redirect('/dashboard');
  }
  
  return session;
}

/**
 * Protect support routes with support role requirement
 */
export async function protectSupport() {
  return await requireRole(['support', 'admin', 'super_admin']);
}

/**
 * Protect account routes
 */
export async function protectAccount() {
  return await checkUserStatus();
}

/**
 * Quick auth check for client components (no redirect)
 */
export async function isAuthenticated(): Promise<boolean> {
  const user = await getCurrentUser();
  return !!user;
}

/**
 * Quick role check for client components (no redirect)
 */
export async function hasAnyRole(roles: string[]): Promise<boolean> {
  const user = await getCurrentUser();
  return user ? roles.includes(user.role) : false;
}

/**
 * Alias for protectAdmin - used by admin pages
 */
export const protectAdminRoute = protectAdmin;
