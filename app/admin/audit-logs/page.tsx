'use client';

import { useState, useEffect } from 'react';
import { Search, AlertCircle, Filter, Download } from 'lucide-react';

interface AuditLog {
  _id: string;
  admin_id: string;
  admin_name: string;
  action: string;
  resource: string;
  resource_id: string;
  changes: Record<string, any>;
  ip_address: string;
  user_agent: string;
  status: 'success' | 'failure';
  createdAt: string;
}

interface AuditLogsData {
  logs: AuditLog[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
  stats: {
    totalLogs: number;
    successCount: number;
    failureCount: number;
    uniqueAdmins: number;
  };
}

export default function AuditLogsPage() {
  const [data, setData] = useState<AuditLogsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [resource, setResource] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    loadLogs();
  }, [page, search, status, resource, dateFrom, dateTo]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(search && { search }),
        ...(status && { status }),
        ...(resource && { resource }),
        ...(dateFrom && { dateFrom }),
        ...(dateTo && { dateTo }),
      });

      const response = await fetch(`/api/admin/audit-logs?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch audit logs');
      }

      const result = await response.json();
      if (result.success) {
        setData(result.data);
      } else {
        setError('Failed to load audit logs');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('[Admin] Audit logs error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const response = await fetch(`/api/admin/audit-logs/export?format=csv`);
      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      alert('Failed to export logs');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto" />
          <p className="mt-4 text-slate-600">Loading audit logs...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <AlertCircle size={20} className="text-red-600" />
          <p className="text-red-700">{error}</p>
        </div>
        <button
          onClick={loadLogs}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Audit Logs</h1>
          <p className="text-slate-600 mt-1">
            Total: {data?.pagination.total.toLocaleString()} log entries
          </p>
        </div>
        <button
          onClick={handleExport}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <Download size={18} />
          Export CSV
        </button>
      </div>

      {/* Stats */}
      {data && (
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-4 border border-slate-200">
            <p className="text-slate-600 text-sm">Total Logs</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{data.stats.totalLogs}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border border-slate-200">
            <p className="text-slate-600 text-sm">Success</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{data.stats.successCount}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border border-slate-200">
            <p className="text-slate-600 text-sm">Failures</p>
            <p className="text-2xl font-bold text-red-600 mt-1">{data.stats.failureCount}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border border-slate-200">
            <p className="text-slate-600 text-sm">Admins</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">{data.stats.uniqueAdmins}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 border border-slate-200">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Search
            </label>
            <div className="relative">
              <Search size={18} className="absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All</option>
              <option value="success">Success</option>
              <option value="failure">Failure</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Resource
            </label>
            <select
              value={resource}
              onChange={(e) => {
                setResource(e.target.value);
                setPage(1);
              }}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Resources</option>
              <option value="user">User</option>
              <option value="blog">Blog</option>
              <option value="survey">Survey</option>
              <option value="transaction">Transaction</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              From
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              To
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase">
                  Admin
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase">
                  Action
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase">
                  Resource
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase">
                  IP Address
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase">
                  Timestamp
                </th>
              </tr>
            </thead>
            <tbody>
              {data?.logs && data.logs.length > 0 ? (
                data.logs.map((log) => (
                  <tr
                    key={log._id}
                    className="border-b border-slate-200 hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <p className="font-medium text-slate-900">{log.admin_name}</p>
                      <p className="text-slate-600 text-xs">{log.admin_id}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-slate-600 text-sm">{log.resource}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          log.status === 'success'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-slate-600 text-sm font-mono">{log.ip_address}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-slate-600 text-sm">
                        {new Date(log.createdAt).toLocaleString()}
                      </p>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-600">
                    No audit logs found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {data && data.pagination.pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-600">
            Showing {data.logs.length} of {data.pagination.total} logs
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Previous
            </button>
            <div className="flex items-center gap-2">
              {Array.from({ length: Math.min(5, data.pagination.pages) }).map((_, i) => {
                const pageNum = i + 1;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                      page === pageNum
                        ? 'bg-blue-600 text-white'
                        : 'border border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setPage(Math.min(data.pagination.pages, page + 1))}
              disabled={page === data.pagination.pages}
              className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
                  <Typography variant="subtitle2" color="text.secondary">
                    Status
                  </Typography>
                  <Chip 
                    label={selectedLog.status} 
                    color={getStatusColor(selectedLog.status) as any}
                    size="small"
                  />
                </Grid>

                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Timestamp
                  </Typography>
                  <Typography variant="body1" gutterBottom>
                    {format(new Date(selectedLog.created_at), 'PPPPpp')}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatDistanceToNow(new Date(selectedLog.created_at))} ago
                  </Typography>
                </Grid>

                {selectedLog.ip_address && (
                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2" color="text.secondary">
                      IP Address
                    </Typography>
                    <Typography variant="body1" fontFamily="monospace">
                      {selectedLog.ip_address}
                    </Typography>
                  </Grid>
                )}

                {selectedLog.user_agent && (
                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2" color="text.secondary">
                      User Agent
                    </Typography>
                    <Typography variant="body2" fontFamily="monospace" fontSize="0.75rem">
                      {selectedLog.user_agent}
                    </Typography>
                  </Grid>
                )}

                {Object.keys(selectedLog.changes || {}).length > 0 && (
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Changes Made
                    </Typography>
                    <Card variant="outlined">
                      <CardContent>
                        <pre style={{ 
                          margin: 0, 
                          fontSize: '0.75rem',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-all'
                        }}>
                          {JSON.stringify(selectedLog.changes, null, 2)}
                        </pre>
                      </CardContent>
                    </Card>
                  </Grid>
                )}

                {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Additional Metadata
                    </Typography>
                    <Card variant="outlined">
                      <CardContent>
                        <pre style={{ 
                          margin: 0, 
                          fontSize: '0.75rem',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-all'
                        }}>
                          {JSON.stringify(selectedLog.metadata, null, 2)}
                        </pre>
                      </CardContent>
                    </Card>
                  </Grid>
                )}
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDetailDialog}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
