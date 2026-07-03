import { Suspense } from 'react';
import { AdminSpinManagementContent } from '../AdminSpinManagementContent';
import { Loader2 } from 'lucide-react';

async function getSpinData() {
  // Server-side fetch: no useState, no useEffect (rule 2)
  try {
    const [settingsRes, logsRes, statsRes] = await Promise.all([
      fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/spin/settings`, { cache: 'no-store' }),
      fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/spin/logs?page=1&limit=10`, { cache: 'no-store' }),
      fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/spin/analytics`, { cache: 'no-store' }),
    ]);

    const settingsData = settingsRes.ok ? await settingsRes.json() : { data: null };
    const logsData = logsRes.ok ? await logsRes.json() : { data: [] };
    const statsData = statsRes.ok ? await statsRes.json() : { data: null };

    return {
      settings: settingsData.data,
      logs: logsData.data || [],
      stats: statsData.data,
    };
  } catch {
    return {
      settings: null,
      logs: [],
      stats: null,
    };
  }
}

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <p className="text-gray-600">Loading spin management...</p>
      </div>
    </div>
  );
}

export default async function AdminSpinManagementPage() {
  // Server Component: no useState, no useEffect, no client libraries needed
  const { settings, logs, stats } = await getSpinData();

  return (
    <Suspense fallback={<LoadingFallback />}>
      <AdminSpinManagementContent 
        initialSettings={settings}
        initialLogs={logs}
        initialStats={stats}
      />
    </Suspense>
  );
}
