'use client';

import { useState, useEffect } from 'react';
import { Clock, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';

interface AuditLog {
  _id: string;
  action: string;
  actor?: {
    _id: string;
    email: string;
    username: string;
  };
  targetType: string;
  resourceType: string;
  actionType: string;
  changes: Record<string, any>;
  description: string;
  ipAddress?: string;
  createdAt: string;
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

const ACTION_TYPES = [
  'APPROVE_USER',
  'REJECT_USER',
  'ACTIVATE_SPIN_WHEEL',
  'DEACTIVATE_SPIN_WHEEL',
  'UPDATE_SPIN_SETTINGS',
  'APPROVE_WITHDRAWAL',
  'REJECT_WITHDRAWAL',
  'PROCESS_WITHDRAWAL',
  'UPDATE_USER_STATUS',
  'CREATE_TRANSACTION',
  'ADMIN_CREDIT',
  'ADMIN_DEBIT',
];

export default function AuditLogsContent() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({ page: 1, limit: 20, total: 0, pages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState('all');
  const [page, setPage] = useState(1);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  useEffect(() => {
    fetchLogs();
  }, [page, action]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(action !== 'all' && { action }),
      });

      const res = await fetch(`/api/admin/audit-logs-page?${params}`);
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch audit logs');
      }

      setLogs(data.data.logs);
      setPagination(data.data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit logs');
      console.error('[v0] Audit logs fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getActionColor = (action: string) => {
    if (action.includes('APPROVE')) return 'text-green-600';
    if (action.includes('REJECT')) return 'text-red-600';
    if (action.includes('DEACTIVATE')) return 'text-yellow-600';
    if (action.includes('DEBIT')) return 'text-red-600';
    if (action.includes('CREDIT')) return 'text-green-600';
    return 'text-blue-600';
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Audit Logs</h1>
        <p className="text-gray-600 text-sm mt-1">Track all admin actions and system changes</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">Action Type</label>
            <select
              value={action}
              onChange={(e) => {
                setAction(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Actions</option>
              {ACTION_TYPES.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={() => {
                setAction('all');
                setPage(1);
              }}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded font-medium text-sm transition"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
          <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
          <div>
            <h3 className="font-semibold text-red-900">Error</h3>
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Audit Logs List */}
      <div className="space-y-3">
        {loading ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto" />
            <p className="text-gray-600 mt-4">Loading audit logs...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <Clock size={32} className="mx-auto text-gray-400 mb-3" />
            <p className="text-gray-600">No audit logs found</p>
          </div>
        ) : (
          <>
            {logs.map((log) => (
              <div key={log._id} className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
                <button
                  onClick={() => setExpandedLog(expandedLog === log._id ? null : log._id)}
                  className="w-full px-6 py-4 hover:bg-gray-50 transition flex items-center justify-between"
                >
                  <div className="flex items-center gap-4 flex-1 text-left">
                    <Clock size={20} className={getActionColor(log.action)} />
                    <div>
                      <p className={`font-semibold ${getActionColor(log.action)}`}>{log.action}</p>
                      <p className="text-sm text-gray-600">
                        {log.actor ? `By ${log.actor.username}` : 'System'} · {new Date(log.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-gray-400">
                    {expandedLog === log._id ? '▼' : '▶'}
                  </div>
                </button>

                {expandedLog === log._id && (
                  <div className="border-t bg-gray-50 px-6 py-4 space-y-3">
                    {log.actor && (
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700">Administrator</h4>
                        <p className="text-sm text-gray-600">{log.actor.email}</p>
                      </div>
                    )}

                    <div>
                      <h4 className="text-sm font-semibold text-gray-700">Target</h4>
                      <p className="text-sm text-gray-600">
                        {log.targetType} · {log.resourceType}
                      </p>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-gray-700">Timestamp</h4>
                      <p className="text-sm text-gray-600">
                        {new Date(log.createdAt).toLocaleString()}
                      </p>
                    </div>

                    {log.ipAddress && (
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700">IP Address</h4>
                        <p className="text-sm text-gray-600">{log.ipAddress}</p>
                      </div>
                    )}

                    {Object.keys(log.changes).length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">Changes</h4>
                        <div className="bg-white rounded p-2 text-xs font-mono text-gray-600 overflow-auto max-h-48">
                          <pre>{JSON.stringify(log.changes, null, 2)}</pre>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* Pagination */}
            <div className="bg-white rounded-lg shadow p-4 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Showing {((page - 1) * pagination.limit) + 1} to {Math.min(page * pagination.limit, pagination.total)} of {pagination.total} logs
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="px-3 py-2 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                >
                  <ChevronLeft size={16} /> Previous
                </button>
                <button
                  onClick={() => setPage(Math.min(pagination.pages, page + 1))}
                  disabled={page === pagination.pages}
                  className="px-3 py-2 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                >
                  Next <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
