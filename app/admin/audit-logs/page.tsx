import { Suspense } from 'react';
import { AuditLogsContent } from '../AuditLogsContent';
import { Loader2 } from 'lucide-react';

interface AdminAuditLog {
  _id: string;
  actor_id: { _id: string; username: string; email: string };
  action: string;
  action_type: string;
  target_type: string;
  target_id: string;
  resource_type: string;
  resource_id: string;
  changes: Record<string, any>;
  metadata: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  status: 'success' | 'failed' | 'pending';
  created_at: string;
  updated_at: string;
}

async function getAuditLogs() {
  // Server-side fetch: no useState, no useEffect (rule 2)
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/audit-logs?page=1&limit=10`, {
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('Failed to fetch audit logs');
    const data = await response.json();
    return {
      logs: data.logs || [],
      total: data.total || 0,
    };
  } catch (error) {
    console.error('[v0] Failed to load audit logs:', error);
    return {
      logs: [],
      total: 0,
    };
  }
}

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <p className="text-gray-600">Loading audit logs...</p>
      </div>
    </div>
  );
}

export default async function AdminAuditLogsPage() {
  // Server Component: fetch data server-side, no useState, no useEffect
  const { logs, total } = await getAuditLogs();

  return (
    <Suspense fallback={<LoadingFallback />}>
      <AuditLogsContent initialLogs={logs} initialTotal={total} />
    </Suspense>
  );
}
