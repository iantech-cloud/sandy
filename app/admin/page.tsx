import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getAdminStats } from '@/app/actions/admin';
import AdminContent from './AdminContent';

// Loading skeleton for Suspense fallback
function AdminSkeleton() {
  return (
    <div className="flex items-center justify-center min-h-64">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading admin dashboard...</p>
      </div>
    </div>
  );
}

// Server Component: Fetches data at request time
async function AdminDataLoader() {
  const session = await auth();

  // Check authorization
  if (!session?.user) {
    redirect('/auth/login');
  }

  // Server-side data fetch: moved from useState + useEffect (rule 2)
  const statsResult = await getAdminStats();

  if (!statsResult.success) {
    if (statsResult.message.includes('Unauthorized') || statsResult.message.includes('Admin access required')) {
      redirect('/auth/login');
    }
    throw new Error(statsResult.message);
  }

  if (!statsResult.data) {
    throw new Error('Failed to load admin statistics');
  }

  return <AdminContent initialStats={statsResult.data} />;
}

export default async function AdminDashboardPage() {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <AdminDataLoader />
    </Suspense>
  );
}
