'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Users, ArrowUpRight, ArrowDownLeft, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

interface Transaction {
  id: string;
  amount: number;
  amount_cents: number;
  transaction_type: 'credit' | 'debit';
  source: string;
  earning_source_type: 'direct' | 'downline' | 'system';
  description: string;
  status: string;
  date: string;
  coop_reference_id?: string;
  mpesa_reference_id?: string;
  downline_username?: string;
  downline_level?: number;
  commission_percentage?: number;
}

interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'direct' | 'downline'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'pending'>('completed');

  useEffect(() => {
    fetchTransactions(currentPage);
  }, [activeTab, statusFilter, currentPage]);

  const fetchTransactions = async (page: number) => {
    try {
      setLoading(true);
      const sourceTypeParam = activeTab === 'all' ? 'all' : activeTab;
      const statusParam = statusFilter === 'all' ? '' : statusFilter;

      const url = new URL('/api/transactions', window.location.origin);
      url.searchParams.set('page', page.toString());
      url.searchParams.set('limit', '20');
      url.searchParams.set('sourceType', sourceTypeParam);
      if (statusParam) url.searchParams.set('status', statusParam);

      const response = await fetch(url.toString());
      if (!response.ok) throw new Error('Failed to fetch transactions');

      const data = await response.json();
      setTransactions(data.data.transactions);
      setPagination(data.data.pagination);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const stats = {
    totalEarnings: transactions
      .filter(t => t.transaction_type === 'credit')
      .reduce((sum, t) => sum + t.amount, 0),
    totalWithdrawals: transactions
      .filter(t => t.transaction_type === 'debit')
      .reduce((sum, t) => sum + t.amount, 0),
    downlineCount: transactions
      .filter(t => t.earning_source_type === 'downline')
      .length
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Transaction History</h1>
          <p className="text-slate-400">View all your earnings and withdrawals</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-gradient-to-br from-green-900/30 to-emerald-900/30 border border-green-500/30 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm mb-1">Total Earnings</p>
                <p className="text-2xl font-bold text-green-400">KES {stats.totalEarnings.toFixed(0)}</p>
              </div>
              <TrendingUp className="w-10 h-10 text-green-500" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-red-900/30 to-rose-900/30 border border-red-500/30 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm mb-1">Total Withdrawals</p>
                <p className="text-2xl font-bold text-red-400">KES {stats.totalWithdrawals.toFixed(0)}</p>
              </div>
              <TrendingDown className="w-10 h-10 text-red-500" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-900/30 to-cyan-900/30 border border-blue-500/30 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm mb-1">Downline Transactions</p>
                <p className="text-2xl font-bold text-blue-400">{stats.downlineCount}</p>
              </div>
              <Users className="w-10 h-10 text-blue-500" />
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-slate-800/50 border border-slate-700/30 rounded-lg p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div>
              <label className="text-slate-300 text-sm font-medium mb-2 block">Earning Source</label>
              <div className="flex gap-2">
                {(['all', 'direct', 'downline'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => {
                      setActiveTab(tab);
                      setCurrentPage(1);
                    }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      activeTab === tab
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)} {tab === 'downline' ? 'Commissions' : 'Earnings'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1">
              <label className="text-slate-300 text-sm font-medium mb-2 block">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as any);
                  setCurrentPage(1);
                }}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 text-white rounded-lg focus:outline-none focus:border-blue-500"
              >
                <option value="all">All Statuses</option>
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
              </select>
            </div>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="bg-slate-800/50 border border-slate-700/30 rounded-lg overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
          ) : transactions.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-slate-400">No transactions found</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-700 bg-slate-900/50">
                      <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Date</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Description</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Type</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Amount</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Status</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Reference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map(txn => (
                      <tr key={txn.id} className="border-b border-slate-700 hover:bg-slate-700/30 transition-colors">
                        <td className="px-6 py-4 text-sm text-slate-300">
                          {format(new Date(txn.date), 'MMM dd, yyyy')}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <div>
                            <p className="text-slate-300 font-medium">{txn.description}</p>
                            {txn.earning_source_type === 'downline' && (
                              <p className="text-xs text-blue-400">
                                From {txn.downline_username} (Level {txn.downline_level}) - {txn.commission_percentage}%
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            txn.earning_source_type === 'downline'
                              ? 'bg-purple-900/30 text-purple-300'
                              : txn.transaction_type === 'credit'
                              ? 'bg-green-900/30 text-green-300'
                              : 'bg-red-900/30 text-red-300'
                          }`}>
                            {txn.earning_source_type === 'downline' ? 'Downline' : txn.transaction_type === 'credit' ? 'Credit' : 'Debit'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm font-semibold">
                          <span className={txn.transaction_type === 'credit' ? 'text-green-400' : 'text-red-400'}>
                            {txn.transaction_type === 'credit' ? '+' : '-'}KES {txn.amount.toFixed(0)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            txn.status === 'completed'
                              ? 'bg-green-900/30 text-green-300'
                              : 'bg-yellow-900/30 text-yellow-300'
                          }`}>
                            {txn.status.charAt(0).toUpperCase() + txn.status.slice(1)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <div className="text-xs text-slate-400">
                            {txn.coop_reference_id && <p>Coop: {txn.coop_reference_id.slice(0, 8)}...</p>}
                            {txn.mpesa_reference_id && <p>M-Pesa: {txn.mpesa_reference_id.slice(0, 8)}...</p>}
                            {!txn.coop_reference_id && !txn.mpesa_reference_id && <p>{txn.id.slice(0, 8)}...</p>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pagination && pagination.totalPages > 1 && (
                <div className="px-6 py-4 border-t border-slate-700 flex items-center justify-between">
                  <p className="text-sm text-slate-400">
                    Page {pagination.currentPage} of {pagination.totalPages} ({pagination.totalCount} total)
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={!pagination.hasPrev}
                      className="px-4 py-2 rounded-lg bg-slate-700 text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-600 transition-colors"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setCurrentPage(p => p + 1)}
                      disabled={!pagination.hasNext}
                      className="px-4 py-2 rounded-lg bg-slate-700 text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-600 transition-colors"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
