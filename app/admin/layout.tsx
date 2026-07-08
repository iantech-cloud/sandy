// app/admin/layout.tsx
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
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

  // Check admin role from session JWT
  const userRole = session.user.role;
  
  if (userRole !== 'admin' && userRole !== 'super_admin') {
    redirect('/dashboard');
  }

  // Pass session to client component
  return <AdminLayoutClient session={session}>{children}</AdminLayoutClient>;
}
