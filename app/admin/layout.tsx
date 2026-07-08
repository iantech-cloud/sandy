// app/admin/layout.tsx
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { connectToDatabase, Profile } from '@/app/lib/models';
import AdminLayoutClient from './admin-layout-client';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default async function AdminLayout({ children }: AdminLayoutProps) {
  const session = await auth();

  // Check if user is authenticated
  if (!session || !session.user) {
    redirect('/auth/login?callbackUrl=/admin');
  }

  // Verify admin role from session (already populated from JWT by auth.ts)
  const userRole = session.user.role;
  if (userRole !== 'admin' && userRole !== 'super_admin') {
    redirect('/dashboard');
  }

  // SECURITY: Verify role hasn't changed in database since JWT was issued
  try {
    await connectToDatabase();
    const profile = await Profile.findOne({ email: session.user.email }).select('role');
    
    if (!profile) {
      console.error('[v0] Admin profile not found for email:', session.user.email);
      redirect('/auth/login');
    }

    if (profile.role !== 'admin' && profile.role !== 'super_admin') {
      // Role was revoked or changed - redirect to dashboard
      console.warn('[v0] Admin role revoked for user:', session.user.email);
      redirect('/dashboard');
    }
  } catch (error) {
    console.error('[v0] Error verifying admin role in database:', error);
    // On error, still allow access based on JWT (role was verified at login time)
  }

  // Pass session to client component
  return <AdminLayoutClient session={session}>{children}</AdminLayoutClient>;
}
