'use client';

import { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, XCircle, Loader2 } from 'lucide-react';

interface Withdrawal {
  _id: string;
  user_id: string;
  username: string;
  email: string;
  amount: number;
  amount_cents: number;
  status: string;
  phone_number: string;
  requested_at: string;
  completed_at: string | null;
  approved_at: string | null;
}

interface WithdrawalsData {
  withdrawals: Withdrawal[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
  stats: {
    totalAmount: number;
    totalWithdrawals: number;
    completedAmount: number;
    completedCount: number;
    pendingCount: number;
  };
}

export default function WithdrawalsPage() {
  const [data, setData] = useState<WithdrawalsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<Withdrawal | null>(null);
  const [actionModal, setActionModal] = useState<'approve' | 'reject' | 'complete' | null>(null);
  const [actionNote, setActionNote] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<'approve' | 'reject' | null>(null);

  useEffect(() => {
    loadWithdrawals();
  }, [page, status]);

  const loadWithdrawals = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(status && { status }),
      });

      const response = await fetch(`/api/admin/withdrawals?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch withdrawals');
      }

      const result = await response.json();
      if (result.success) {
        setData(result.data);
      } else {
        setError('Failed to load withdrawals');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('[Admin] Withdrawals error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusFilter = (value: string) => {
    setStatus(value);
    setPage(1);
  };

  const toggleSelectWithdrawal = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (data?.withdrawals) {
      if (selectedIds.size === data.withdrawals.length) {
        setSelectedIds(new Set());
      } else {
        setSelectedIds(new Set(data.withdrawals.map(w => w._id)));
      }
    }
  };

  const handleApproveAction = async () => {
    if (!selectedWithdrawal) return;
    setActionLoading(true);
    try {
      const response = await fetch('/api/admin/withdrawals/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          withdrawalId: selectedWithdrawal._id,
          notes: actionNote,
        }),
      });

      const result = await response.json();
      if (result.success) {
        setActionModal(null);
        setActionNote('');
        setSelectedWithdrawal(null);
        loadWithdrawals();
      } else {
        setError(result.message || 'Failed to approve withdrawal');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error approving withdrawal');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectAction = async () => {
    if (!selectedWithdrawal || !actionNote.trim()) {
      setError('Rejection reason is required');
      return;
    }
    setActionLoading(true);
    try {
      const response = await fetch('/api/admin/withdrawals/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          withdrawalId: selectedWithdrawal._id,
          reason: actionNote,
        }),
      });

      const result = await response.json();
      if (result.success) {
        setActionModal(null);
        setActionNote('');
        setSelectedWithdrawal(null);
        loadWithdrawals();
      } else {
        setError(result.message || 'Failed to reject withdrawal');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error rejecting withdrawal');
    } finally {
      setActionLoading(false);
    }
  };

  const handleBulkApprove = async () => {
    if (selectedIds.size === 0) {
      setError('No withdrawals selected');
      return;
    }
    setActionLoading(true);
    try {
      const response = await fetch('/api/admin/withdrawals/bulk-approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          withdrawalIds: Array.from(selectedIds),
        }),
      });

      const result = await response.json();
      if (result.success) {
        setSelectedIds(new Set());
        setBulkAction(null);
        loadWithdrawals();
      } else {
        setError(result.message || 'Bulk approval failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error in bulk approval');
    } finally {
      setActionLoading(false);
    }
  };

  const formatCurrency = (amountCents: number) => {
    const amountKES = amountCents / 100;
    return `KES ${amountKES.toLocaleString('en-KE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto" />
          <p className="mt-4 text-slate-600">Loading withdrawals...</p>
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
          onClick={loadWithdrawals}
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
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Withdrawals</h1>
        <p className="text-slate-600 mt-1">
          Total: {data?.pagination.total.toLocaleString()} withdrawal requests
        </p>
      </div>

      {/* Stats Cards */}
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow p-6 border border-slate-200">
            <p className="text-slate-600 text-sm font-medium">Total Amount</p>
            <p className="text-2xl font-bold text-slate-900 mt-2">
              {formatCurrency(data.stats.totalAmount)}
            </p>
            <p className="text-xs text-slate-500 mt-1">{data.stats.totalWithdrawals} requests</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border border-slate-200">
            <p className="text-slate-600 text-sm font-medium">Completed</p>
            <p className="text-2xl font-bold text-green-600 mt-2">
              {formatCurrency(data.stats.completedAmount)}
            </p>
            <p className="text-xs text-slate-500 mt-1">{data.stats.completedCount} processed</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border border-slate-200">
            <p className="text-slate-600 text-sm font-medium">Pending</p>
            <p className="text-2xl font-bold text-yellow-600 mt-2">
              {data.stats.pendingCount}
            </p>
            <p className="text-xs text-slate-500 mt-1">Awaiting disbursement</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border border-slate-200">
            <p className="text-slate-600 text-sm font-medium">Completion Rate</p>
            <p className="text-2xl font-bold text-blue-600 mt-2">
              {data.stats.totalWithdrawals > 0
                ? ((data.stats.completedCount / data.stats.totalWithdrawals) * 100).toFixed(1)
                : 0}%
            </p>
            <p className="text-xs text-slate-500 mt-1">Of total requests</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6 border border-slate-200">
        <select
          value={status}
          onChange={(e) => handleStatusFilter(e.target.value)}
          className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Statuses</option>
          <option value="completed">Completed</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
        </select>
      </div>

      {/* Withdrawals Table */}
      <div className="bg-white rounded-lg shadow border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700 w-12">
                  <input
                    type="checkbox"
                    checked={data?.withdrawals ? selectedIds.size === data.withdrawals.length : false}
                    onChange={toggleSelectAll}
                    className="rounded border-slate-300"
                  />
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">
                  User
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">
                  Phone Number
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">
                  Requested
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">
                  Completed
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {data?.withdrawals && data.withdrawals.length > 0 ? (
                data.withdrawals.map((wd) => (
                  <tr key={wd._id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(wd._id)}
                        onChange={() => toggleSelectWithdrawal(wd._id)}
                        disabled={wd.status !== 'pending'}
                        className="rounded border-slate-300 disabled:opacity-50"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{wd.username}</p>
                        <p className="text-xs text-slate-600">{wd.email}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">
                      {formatCurrency(wd.amount_cents)}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          wd.status === 'completed'
                            ? 'bg-green-100 text-green-700'
                            : wd.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-700'
                            : wd.status === 'approved'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {wd.status.charAt(0).toUpperCase() + wd.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 font-mono text-xs">
                      {wd.phone_number || 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {new Date(wd.requested_at).toLocaleDateString('en-KE', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {wd.completed_at
                        ? new Date(wd.completed_at).toLocaleDateString('en-KE', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '-'}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {wd.status === 'pending' && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setSelectedWithdrawal(wd);
                              setActionModal('approve');
                              setActionNote('');
                            }}
                            className="px-3 py-1 bg-green-100 text-green-700 hover:bg-green-200 rounded text-xs font-medium transition-colors"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => {
                              setSelectedWithdrawal(wd);
                              setActionModal('reject');
                              setActionNote('');
                            }}
                            className="px-3 py-1 bg-red-100 text-red-700 hover:bg-red-200 rounded text-xs font-medium transition-colors"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-600">
                    No withdrawal requests found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
          <p className="text-blue-900 font-medium">
            {selectedIds.size} withdrawal{selectedIds.size !== 1 ? 's' : ''} selected
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setBulkAction('approve');
                setActionLoading(false);
              }}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
            >
              Bulk Approve
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-4 py-2 bg-slate-300 text-slate-700 rounded-lg hover:bg-slate-400 transition-colors text-sm font-medium"
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* Action Modal */}
      {actionModal && selectedWithdrawal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">
              {actionModal === 'approve' && 'Approve Withdrawal'}
              {actionModal === 'reject' && 'Reject Withdrawal'}
              {actionModal === 'complete' && 'Complete Withdrawal'}
            </h2>

            <div className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-lg">
                <p className="text-sm text-slate-600">
                  <span className="font-semibold">Amount:</span> {formatCurrency(selectedWithdrawal.amount_cents)}
                </p>
                <p className="text-sm text-slate-600">
                  <span className="font-semibold">User:</span> {selectedWithdrawal.username}
                </p>
                <p className="text-sm text-slate-600">
                  <span className="font-semibold">Phone:</span> {selectedWithdrawal.phone_number || 'N/A'}
                </p>
                <p className="text-sm text-slate-600 mt-2">
                  <span className="font-semibold">Requested:</span> {new Date(selectedWithdrawal.requested_at).toLocaleDateString('en-KE', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>

              {(actionModal === 'reject' || actionModal === 'complete') && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    {actionModal === 'reject' ? 'Rejection Reason' : 'Transaction Code'}
                  </label>
                  <textarea
                    value={actionNote}
                    onChange={(e) => setActionNote(e.target.value)}
                    placeholder={
                      actionModal === 'reject'
                        ? 'Enter reason for rejection (minimum 10 characters)...'
                        : 'Enter M-Pesa transaction code...'
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                  />
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setActionModal(null);
                    setActionNote('');
                    setSelectedWithdrawal(null);
                  }}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (actionModal === 'approve') handleApproveAction();
                    else if (actionModal === 'reject') handleRejectAction();
                    else if (actionModal === 'complete') handleApproveAction();
                  }}
                  disabled={
                    actionLoading ||
                    (actionModal === 'reject' && actionNote.trim().length < 10) ||
                    (actionModal === 'complete' && !actionNote.trim())
                  }
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
                >
                  {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {actionModal === 'approve' && 'Approve'}
                  {actionModal === 'reject' && 'Reject'}
                  {actionModal === 'complete' && 'Complete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Approval Confirmation Modal */}
      {bulkAction === 'approve' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">
              Bulk Approve Withdrawals
            </h2>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-yellow-900">
                You are about to approve <span className="font-bold">{selectedIds.size}</span> withdrawal{selectedIds.size !== 1 ? 's' : ''}.
              </p>
              <p className="text-sm text-yellow-900 mt-2">
                Total amount: <span className="font-bold">
                  {formatCurrency(
                    Array.from(selectedIds).reduce((sum, id) => {
                      const w = data?.withdrawals.find(wd => wd._id === id);
                      return sum + (w?.amount_cents || 0);
                    }, 0)
                  )}
                </span>
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setBulkAction(null);
                  setSelectedIds(new Set());
                }}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkApprove}
                disabled={actionLoading}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
              >
                {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Confirm Approval
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pagination */}
      {data && data.pagination.pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-600">
            Page {data.pagination.page} of {data.pagination.pages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() =>
                setPage(Math.min(data.pagination.pages, page + 1))
              }
              disabled={page === data.pagination.pages}
              className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
