import { Suspense } from 'react';
import { auth } from '@/auth';
import { fetchDashboardData } from '@/app/lib/data';
import DashboardContent from './DashboardContent';
import { Loader2 } from 'lucide-react';

// Loading skeleton for Suspense fallback
function DashboardSkeleton() {
  return (
    <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-50/30">
      <div className="text-center">
        <div className="relative inline-flex">
          <Loader2 className="animate-spin text-blue-600 w-10 h-10" />
          <div className="absolute inset-0 animate-ping">
            <Loader2 className="text-cyan-400 w-10 h-10 opacity-20" />
          </div>
        </div>
        <p className="mt-3 text-lg font-medium text-slate-700">Loading dashboard...</p>
      </div>
    </div>
  );
}

// Server Component: Fetches data at request time
async function DashboardDataLoader() {
  const session = await auth();
  
  if (!session?.user?.id) {
    throw new Error('User not authenticated');
  }

  // Server-side data fetch: moved from useState + useEffect (rule 2)
  const dashboardData = await fetchDashboardData(session.user.id);
  
  return <DashboardContent initialData={dashboardData} />;
}

export default async function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardDataLoader />
    </Suspense>
  );
}
