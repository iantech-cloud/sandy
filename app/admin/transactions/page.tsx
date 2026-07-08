'use client';

import { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';

interface Transaction {
  _id: string;
  user_id: string;
  phone_number: string;
  amount: number;
  status: string;
  paid_at: string;
  checkout_request_id: string;
  createdAt: string;
}

interface TransactionsData {
  transactions: Transaction[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
  stats: {
    totalAmount: number;
    totalTransactions: number;
    completedAmount: number;
    completedCount: number;
    pendingCount: number;
    failedCount: number;
  };
}

export default function TransactionsPage() {
  const [data, setData] = useState<TransactionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');

  useEffect(() => {
    loadTransactions();
  }, [page, status]);

  const loadTransactions = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(status && { status }),
      });

      const response = await fetch(`/api/admin/transactions?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch transactions');
      }

      const result = await response.json();
      if (result.success) {
        setData(result.data);
      } else {
        setError('Failed to load transactions');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('[Admin] Transactions error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusFilter = (value: string) => {
    setStatus(value);
    setPage(1);
  };

  const formatCurrency = (amount: number) => {
    return `KES ${(amount / 100).toLocaleString('en-KE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto" />
          <p className="mt-4 text-slate-600">Loading transactions...</p>
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
          onClick={loadTransactions}
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
        <h1 className="text-3xl font-bold text-slate-900">Transactions</h1>
        <p className="text-slate-600 mt-1">
          Total: {data?.pagination.total.toLocaleString()} transactions
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
            <p className="text-xs text-slate-500 mt-1">{data.stats.totalTransactions} transactions</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border border-slate-200">
            <p className="text-slate-600 text-sm font-medium">Completed</p>
            <p className="text-2xl font-bold text-green-600 mt-2">
              {formatCurrency(data.stats.completedAmount)}
            </p>
            <p className="text-xs text-slate-500 mt-1">{data.stats.completedCount} completed</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border border-slate-200">
            <p className="text-slate-600 text-sm font-medium">Pending</p>
            <p className="text-2xl font-bold text-yellow-600 mt-2">
              {data.stats.pendingCount}
            </p>
            <p className="text-xs text-slate-500 mt-1">Awaiting payment</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border border-slate-200">
            <p className="text-slate-600 text-sm font-medium">Failed</p>
            <p className="text-2xl font-bold text-red-600 mt-2">
              {data.stats.failedCount}
            </p>
            <p className="text-xs text-slate-500 mt-1">Transaction failures</p>
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
          <option value="failed">Failed</option>
        </select>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-lg shadow border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">
                  Phone Number
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">
                  Request ID
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {data?.transactions && data.transactions.length > 0 ? (
                data.transactions.map((txn) => (
                  <tr key={txn._id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">
                      {txn.phone_number}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {formatCurrency(txn.amount)}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          txn.status === 'completed'
                            ? 'bg-green-100 text-green-700'
                            : txn.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {txn.status.charAt(0).toUpperCase() + txn.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 font-mono text-xs">
                      {txn.checkout_request_id || 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {new Date(txn.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-600">
                    No transactions found
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
