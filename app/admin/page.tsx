import { redirect } from 'next/navigation';
import { protectAdminRoute } from '@/app/lib/auth/auth-actions';
import AdminDashboard from './DashboardContent';

export default async function AdminPage() {
  // Server-side auth guard
  const authResult = await protectAdminRoute();
  if (!authResult.authorized) {
    redirect('/auth/login');
  }

  return <AdminDashboard />;
}
