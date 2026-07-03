import { Suspense } from 'react';
import { DashboardLocalGigsContent } from '../DashboardLocalGigsContent';
import { Loader2 } from 'lucide-react';

async function getLocalGigsStats() {
  // Server-side fetch: no useState, no useEffect (rule 2)
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/marketplace/local-gigs`, {
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('Failed to load stats');
    const data = await response.json();
    return {
      gigsCompleted: data.data?.gigsCompleted || 0,
      activeListings: data.data?.activeListings || 0,
      totalEarnings: data.data?.totalEarnings || 0,
    };
  } catch (error) {
    console.error('[v0] Failed to load local gigs stats:', error);
    return {
      gigsCompleted: 0,
      activeListings: 0,
      totalEarnings: 0,
    };
  }
}

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-600" />
        <p className="text-gray-600">Loading local gigs...</p>
      </div>
    </div>
  );
}

export default async function LocalGigsPage() {
  // Server Component: fetch data server-side, no useState, no useEffect
  const stats = await getLocalGigsStats();

  return (
    <Suspense fallback={<LoadingFallback />}>
      <DashboardLocalGigsContent initialStats={stats} />
    </Suspense>
  );
}
