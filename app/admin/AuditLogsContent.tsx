'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, formatDistanceToNow } from 'date-fns';
import { Search, Filter, Eye, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface AuditLogActor {
  _id: string;
  username: string;
  email: string;
}

interface AdminAuditLog {
  _id: string;
  actor_id: AuditLogActor;
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

interface AuditLogsContentProps {
  initialLogs: AdminAuditLog[];
  initialTotal: number;
}

export function AuditLogsContent({ initialLogs, initialTotal }: AuditLogsContentProps) {
  // useState: local UI state only (rule 6)
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedLog, setSelectedLog] = useState<AdminAuditLog | null>(null);

  // React Query: handles data fetching with caching (rule 2)
  const { data: queryData, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['auditLogs', page, rowsPerPage, searchTerm, actionFilter, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: (page + 1).toString(),
        limit: rowsPerPage.toString(),
        search: searchTerm,
        actionFilter,
        statusFilter,
      });
      
      const response = await fetch(`/api/admin/audit-logs?${params}`, {
        cache: 'no-store',
      });
      
      if (!response.ok) throw new Error('Failed to fetch audit logs');
      const data = await response.json();
      return data.data || { logs: initialLogs, total: initialTotal };
    },
    initialData: { logs: initialLogs, total: initialTotal },
    staleTime: 30000,
  });

  const logs = queryData?.logs || [];
  const totalCount = queryData?.total || 0;

  const handleRefresh = async () => {
    try {
      await refetch();
      toast.success('Audit logs refreshed');
    } catch {
      toast.error('Failed to refresh logs');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'text-green-600 bg-green-50';
      case 'failed': return 'text-red-600 bg-red-50';
      case 'pending': return 'text-yellow-600 bg-yellow-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getActionIcon = (action: string) => {
    const actions: Record<string, string> = {
      'user_created': '👤',
      'user_banned': '🚫',
      'payment_approved': '✓',
      'content_rejected': '❌',
      'admin_login': '🔓',
    };
    return actions[action] || '📋';
  };

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchesSearch = !searchTerm || 
        log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.actor_id?.email?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesAction = actionFilter === 'all' || log.action_type === actionFilter;
      const matchesStatus = statusFilter === 'all' || log.status === statusFilter;
      
      return matchesSearch && matchesAction && matchesStatus;
    });
  }, [logs, searchTerm, actionFilter, statusFilter]);

  return (
    <div className="p-6 bg-white rounded-lg">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Audit Logs</h1>
        <button
          onClick={handleRefresh}
          disabled={isFetching}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Search and Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by action or email..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(0);
            }}
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <select
          value={actionFilter}
          onChange={(e) => {
            setActionFilter(e.target.value);
            setPage(0);
          }}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Actions</option>
          <option value="user_created">User Created</option>
          <option value="user_banned">User Banned</option>
          <option value="payment_approved">Payment Approved</option>
          <option value="content_rejected">Content Rejected</option>
          <option value="admin_login">Admin Login</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(0);
          }}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Status</option>
          <option value="success">Success</option>
          <option value="failed">Failed</option>
          <option value="pending">Pending</option>
        </select>
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="flex items-center justify-center p-8">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading audit logs...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Table */}
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Action</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Actor</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Target</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Time</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr key={log._id} className="border-b hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm">{getActionIcon(log.action)} {log.action}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{log.actor_id?.email || 'System'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{log.target_type}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getStatusColor(log.status)}`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="p-2 hover:bg-gray-200 rounded"
                      >
                        <Eye className="w-4 h-4 text-gray-600" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex justify-between items-center mt-6">
            <p className="text-sm text-gray-600">
              Showing {page * rowsPerPage + 1} to {Math.min((page + 1) * rowsPerPage, totalCount)} of {totalCount}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(page + 1)}
                disabled={(page + 1) * rowsPerPage >= totalCount}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}

      {/* Details Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Log Details</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-semibold text-gray-700">Action</label>
                <p className="text-gray-900">{selectedLog.action}</p>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700">Actor</label>
                <p className="text-gray-900">{selectedLog.actor_id?.email || 'System'}</p>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700">Status</label>
                <p className={`text-sm font-medium ${getStatusColor(selectedLog.status)}`}>{selectedLog.status}</p>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700">Timestamp</label>
                <p className="text-gray-900">{format(new Date(selectedLog.created_at), 'PPpp')}</p>
              </div>
              {selectedLog.ip_address && (
                <div>
                  <label className="text-sm font-semibold text-gray-700">IP Address</label>
                  <p className="text-gray-900 font-mono text-xs">{selectedLog.ip_address}</p>
                </div>
              )}
              <div>
                <label className="text-sm font-semibold text-gray-700">Changes</label>
                <pre className="bg-gray-50 p-3 rounded text-xs overflow-auto max-h-40">
                  {JSON.stringify(selectedLog.changes, null, 2)}
                </pre>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
