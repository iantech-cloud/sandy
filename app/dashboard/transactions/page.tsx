'use client';

import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown, Users, Loader2, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

interface Transaction {
  id: string;
  amount: number;
  amount_cents: number;
  transaction_type: 'credit' | 'debit';
  source: string;
  earning_source_type: string;
  description: string;
  status: string;
  date: string;
  coop_reference_id?: string;
  mpesa_reference_id?: string;
  downline_level?: string | number;
  metadata?: Record<string, any>;
}

interface Stats {
  totalEarnings: number;
  totalWithdrawals: number;
  downlineEarnings: number;
  walletBalance: number;
}

interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  hasNext: boolean;
  hasPrev: boolean;
}

function friendlyType(txn: Transaction): { label: string; color: string } {
  const s = txn.source?.toUpperCase() || '';
  const e = txn.earning_source_type?.toLowerCase() || '';

  if (e === 'downline')               return { label: 'Downline Bonus',     color: 'bg-purple-900/30 text-purple-300' };
  if (s === 'REFERRAL')               return { label: 'Referral Bonus',     color: 'bg-purple-900/30 text-purple-300' };
  if (s === 'ACTIVATION_FEE')         return { label: 'Activation Fee',     color: 'bg-yellow-900/30 text-yellow-300' };
  if (s === 'ACCOUNT_ACTIVATION')     return { label: 'Activation',         color: 'bg-yellow-900/30 text-yellow-300' };
  if (s === 'DEPOSIT' || s === 'CHAT_DEPOSIT') return { label: 'Deposit', color: 'bg-blue-900/30 text-blue-300' };
  if (s === 'WITHDRAWAL' || s === 'CHAT_WITHDRAWAL') return { label: 'Withdrawal', color: 'bg-red-900/30 text-red-300' };
  if (s.includes('SPIN'))             return { label: 'Spin',               color: 'bg-pink-900/30 text-pink-300' };
  if (s === 'SURVEY')                 return { label: 'Survey Reward',      color: 'bg-indigo-900/30 text-indigo-300' };
  if (s === 'BONUS' || s === 'ADMIN_CREDIT') return { label: 'Bonus/Credit', color: 'bg-green-900/30 text-green-300' };
  if (s === 'CHAT_MESSAGE_EARNING')   return { label: 'Chat Earning',       color: 'bg-teal-900/30 text-teal-300' };
  if (s === 'CHAT_REFERRAL_EARNING')  return { label: 'Chat Referral',      color: 'bg-purple-900/30 text-purple-300' };
  if (txn.transaction_type === 'credit') return { label: 'Earnings',        color: 'bg-green-900/30 text-green-300' };
  return { label: 'Debit',              color: 'bg-red-900/30 text-red-300' };
}

function safeDate(date: string | null | undefined): string {
  if (!date) return 'N/A';
  try {
    return format(new Date(date), 'MMM dd, yyyy HH:mm');
  } catch {
    return 'Invalid date';
  }
}

function refLabel(txn: Transaction): string {
  const coop  = txn.coop_reference_id;
  const mpesa = txn.mpesa_reference_id;
  if (coop && coop !== 'N/A')  return `Ref: ${coop.slice(0, 12)}`;
  if (mpesa && mpesa !== 'N/A') return `M-Pesa: ${mpesa.slice(0, 12)}`;
  return txn.id.slice(-8).toUpperCase();
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stats, setStats]               = useState<Stats>({ totalEarnings: 0, totalWithdrawals: 0, downlineEarnings: 0, walletBalance: 0 });
  const [pagination, setPagination]     = useState<PaginationInfo | null>(null);
  const [loading, setLoading]           = useState(true);
  const [activeTab, setActiveTab]       = useState<'all' | 'direct' | 'downline'>('all');
  const [currentPage, setCurrentPage]   = useState(1);
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'pending'>('all');

  const fetchTransactions = useCallback(async (page: number) => {
    try {
      setLoading(true);
      const url = new URL('/api/transactions', window.location.origin);
      url.searchParams.set('page', page.toString());
      url.searchParams.set('limit', '20');
      url.searchParams.set('sourceType', activeTab);
      if (statusFilter !== 'all') url.searchParams.set('status', statusFilter);

      const response = await fetch(url.toString());
      if (!response.ok) throw new Error('Failed to fetch transactions');

      const data = await response.json();
      setTransactions(data.data.transactions || []);
      setPagination(data.data.pagination);
      if (data.data.stats) setStats(data.data.stats);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  }, [activeTab, statusFilter]);

  useEffect(() => {
    fetchTransactions(currentPage);
  }, [fetchTransactions, currentPage]);

  const handleTabChange = (tab: typeof activeTab) => {
    setActiveTab(tab);
    setCurrentPage(1);
  };

  const handleStatusChange = (s: typeof statusFilter) => {
    setStatusFilter(s);
    setCurrentPage(1);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-1">Transaction History</h1>
            <p className="text-slate-400 text-sm">A complete record of all your earnings, payments, and withdrawals</p>
          </div>
          <button
            onClick={() => fetchTransactions(currentPage)}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gradient-to-br from-green-900/30 to-emerald-900/30 border border-green-500/30 rounded-lg p-5">
            <p className="text-slate-400 text-xs mb-1 uppercase tracking-wide">Total Earnings</p>
            <p className="text-2xl font-bold text-green-400">KES {stats.totalEarnings.toLocaleString('en-KE', { minimumFractionDigits: 0 })}</p>
            <TrendingUp className="w-6 h-6 text-green-500 mt-2" />
          </div>

          <div className="bg-gradient-to-br from-red-900/30 to-rose-900/30 border border-red-500/30 rounded-lg p-5">
            <p className="text-slate-400 text-xs mb-1 uppercase tracking-wide">Total Withdrawals</p>
            <p className="text-2xl font-bold text-red-400">KES {stats.totalWithdrawals.toLocaleString('en-KE', { minimumFractionDigits: 0 })}</p>
            <TrendingDown className="w-6 h-6 text-red-500 mt-2" />
          </div>

          <div className="bg-gradient-to-br from-purple-900/30 to-violet-900/30 border border-purple-500/30 rounded-lg p-5">
            <p className="text-slate-400 text-xs mb-1 uppercase tracking-wide">Downline Earnings</p>
            <p className="text-2xl font-bold text-purple-400">KES {stats.downlineEarnings.toLocaleString('en-KE', { minimumFractionDigits: 0 })}</p>
            <Users className="w-6 h-6 text-purple-500 mt-2" />
          </div>

          <div className="bg-gradient-to-br from-blue-900/30 to-cyan-900/30 border border-blue-500/30 rounded-lg p-5">
            <p className="text-slate-400 text-xs mb-1 uppercase tracking-wide">Wallet Balance</p>
            <p className="text-2xl font-bold text-blue-400">KES {stats.walletBalance.toLocaleString('en-KE', { minimumFractionDigits: 0 })}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-slate-800/50 border border-slate-700/30 rounded-lg p-5 mb-6">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-end">
            <div>
              <label className="text-slate-400 text-xs font-medium mb-2 block uppercase tracking-wide">Filter by type</label>
              <div className="flex gap-2 flex-wrap">
                {(['all', 'direct', 'downline'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => handleTabChange(tab)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      activeTab === tab
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {tab === 'all' ? 'All Transactions' : tab === 'direct' ? 'Direct Earnings' : 'Downline Commissions'}
                  </button>
                ))}
              </div>
            </div>

            <div className="md:ml-auto">
              <label className="text-slate-400 text-xs font-medium mb-2 block uppercase tracking-wide">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => handleStatusChange(e.target.value as typeof statusFilter)}
                className="px-4 py-2 bg-slate-700 border border-slate-600 text-white rounded-lg focus:outline-none focus:border-blue-500 text-sm"
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
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
              <p className="text-slate-400 text-sm">Loading transactions&hellip;</p>
            </div>
          ) : transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-2">
              <p className="text-slate-300 font-medium">No transactions found</p>
              <p className="text-slate-500 text-sm">Try changing the filter or check back later.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-700 bg-slate-900/50">
                      <th className="px-5 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Date</th>
                      <th className="px-5 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Description</th>
                      <th className="px-5 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Type</th>
                      <th className="px-5 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Amount</th>
                      <th className="px-5 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                      <th className="px-5 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Reference</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {transactions.map(txn => {
                      const { label, color } = friendlyType(txn);
                      const isCredit = txn.transaction_type === 'credit';
                      return (
                        <tr key={txn.id} className="hover:bg-slate-700/30 transition-colors">
                          <td className="px-5 py-4 text-sm text-slate-400 whitespace-nowrap">
                            {safeDate(txn.date)}
                          </td>
                          <td className="px-5 py-4 text-sm max-w-xs">
                            <p className="text-slate-200 font-medium leading-snug">{txn.description || 'Transaction'}</p>
                            {txn.earning_source_type === 'downline' && txn.downline_level !== 'N/A' && (
                              <p className="text-xs text-purple-400 mt-0.5">
                                Level {txn.downline_level} downline commission
                              </p>
                            )}
                          </td>
                          <td className="px-5 py-4">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${color}`}>
                              {label}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-sm font-semibold whitespace-nowrap">
                            <span className={isCredit ? 'text-green-400' : 'text-red-400'}>
                              {isCredit ? '+' : '-'}KES {txn.amount.toLocaleString('en-KE', { minimumFractionDigits: 0 })}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                              txn.status === 'completed'
                                ? 'bg-green-900/30 text-green-300'
                                : txn.status === 'failed'
                                ? 'bg-red-900/30 text-red-300'
                                : 'bg-yellow-900/30 text-yellow-300'
                            }`}>
                              {txn.status ? txn.status.charAt(0).toUpperCase() + txn.status.slice(1) : 'Unknown'}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-xs text-slate-500 font-mono whitespace-nowrap">
                            {refLabel(txn)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pagination && pagination.totalPages > 1 && (
                <div className="px-5 py-4 border-t border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <p className="text-sm text-slate-400">
                    Showing page {pagination.currentPage} of {pagination.totalPages}
                    <span className="text-slate-500"> &middot; {pagination.totalCount} transactions total</span>
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={!pagination.hasPrev}
                      className="px-4 py-2 rounded-lg bg-slate-700 text-slate-300 text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-600 transition-colors"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setCurrentPage(p => p + 1)}
                      disabled={!pagination.hasNext}
                      className="px-4 py-2 rounded-lg bg-slate-700 text-slate-300 text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-600 transition-colors"
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
