import { Suspense } from 'react';
import { DashboardFreelanceContent } from '../DashboardFreelanceContent';
import { Briefcase, Loader2 } from 'lucide-react';

interface FreelanceStats {
  activeJobs: number;
  totalEarned: number;
  completionRate: number;
}

async function getFreelanceStats(): Promise<FreelanceStats> {
  // Server-side fetch: no useState, no useEffect (rule 2)
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/marketplace/freelance`,
      { cache: 'no-store' }
    );
    if (!response.ok) throw new Error('Failed to load stats');
    const data = await response.json();
    return {
      activeJobs: data.data?.activeJobs || 0,
      totalEarned: data.data?.totalEarned || 0,
      completionRate: data.data?.completionRate || 0,
    };
  } catch (error) {
    console.error('Failed to load freelance stats:', error);
    return { activeJobs: 0, totalEarned: 0, completionRate: 0 };
  }
}

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <p className="text-gray-600">Loading freelance data...</p>
      </div>
    </div>
  );
}

export default async function FreelancePage() {
  // Server Component: no useState, no useEffect, no client libraries needed
  const stats = await getFreelanceStats();

  return (
    <Suspense fallback={<LoadingFallback />}>
      <DashboardFreelanceContent initialStats={stats} />
    </Suspense>
  );
}
