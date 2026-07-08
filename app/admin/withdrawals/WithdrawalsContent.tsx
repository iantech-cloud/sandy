'use client';

import { useState, useEffect } from 'react';
import { DollarSign, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';

interface Withdrawal {
  _id: string;
  user: {
    _id: string;
    email: string;
    username: string;
    name: string;
  };
  amount: number;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  method: string;
  recipient: string;
  requestedAt: string;
  processedAt: string;
  notes: string;
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export default function WithdrawalsContent() {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({ page: 1, limit: 10, total: 0, pages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('pending');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchWithdrawals();
  }, [page, status, search]);

  const fetchWithdrawals = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        status,
        ...(search && { search }),
      });

      const res = await fetch(`/api/admin/withdrawals?${params}`);
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch withdrawals');
      }

      setWithdrawals(data.data.withdrawals);
      setPagination(data.data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load withdrawals');
      console.error('[v0] Withdrawals fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'approved':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Withdrawal Management</h1>
        <p className="text-gray-600 text-sm mt-1">Process and track user withdrawal requests</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Search</label>
            <input
              type="text"
              placeholder="Email or username..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="completed">Completed</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={() => {
                setStatus('pending');
                setSearch('');
                setPage(1);
              }}
              className="w-full px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded font-medium text-sm transition"
            >
              Reset Filters
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

      {/* Withdrawals Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto" />
            <p className="text-gray-600 mt-4">Loading withdrawals...</p>
          </div>
        ) : withdrawals.length === 0 ? (
          <div className="p-8 text-center">
            <DollarSign size={32} className="mx-auto text-gray-400 mb-3" />
            <p className="text-gray-600">No withdrawals found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">User</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Method</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Recipient</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Requested</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {withdrawals.map((w) => (
                    <tr key={w._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-gray-900">{w.user.username}</p>
                          <p className="text-sm text-gray-600">{w.user.email}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-semibold">
                          {w.amount.toLocaleString('en-US', { style: 'currency', currency: 'KES' })}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 capitalize">
                        {w.method}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {w.recipient || '—'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(w.status)}`}>
                          {w.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(w.requestedAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="bg-gray-50 border-t px-6 py-4 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Showing {((page - 1) * pagination.limit) + 1} to {Math.min(page * pagination.limit, pagination.total)} of {pagination.total} withdrawals
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
