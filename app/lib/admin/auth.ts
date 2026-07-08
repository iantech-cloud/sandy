import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';

/**
 * Server-side auth check for admin pages
 * Redirects to login if not authenticated or if user is not admin
 */
export async function protectAdminRoute() {
  const session = await auth();

  if (!session?.user?.email) {
    redirect('/auth/login');
  }

  const userRole = (session.user as any).role;
  
  if (userRole !== 'admin' && userRole !== 'super_admin') {
    redirect('/dashboard');
  }

  return session;
}

/**
 * API route protection for admin endpoints
 * Returns 401 if not authenticated or not admin
 */
export async function validateAdminRequest() {
  const session = await auth();

  if (!session?.user?.email) {
    return {
      authorized: false,
      error: 'Unauthorized. Please log in.',
      status: 401,
    };
  }

  const userRole = (session.user as any).role;
  
  if (userRole !== 'admin' && userRole !== 'super_admin') {
    return {
      authorized: false,
      error: 'Forbidden. Admin access required.',
      status: 403,
    };
  }

  return {
    authorized: true,
    session,
    status: 200,
  };
}

/**
 * Check if user is admin without redirecting
 */
export async function isAdmin(): Promise<boolean> {
  const session = await auth();
  if (!session?.user?.email) return false;
  
  const userRole = (session.user as any).role;
  return userRole === 'admin' || userRole === 'super_admin';
}
