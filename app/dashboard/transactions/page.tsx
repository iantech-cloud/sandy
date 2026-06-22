'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { TrendingUp, TrendingDown, Users, Wallet, Loader2, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';

interface Transaction {
  id: string;
  amount: number;
  amount_cents: number;
  transaction_type: 'credit' | 'debit';
  type_label: string;
  source: string;
  earning_source_type: string;
  description: string;
  status: string;
  date: string;
  target_user: string;
  coop_reference_id?: string;
  mpesa_reference_id?: string;
  downline_level?: string | number;
  balance_after?: number | string;
  collection?: string;
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
  limit: number;
}

function safeDate(d: string | null | undefined): string {
  if (!d) return 'N/A';
  try { return format(new Date(d), 'dd MMM yyyy, HH:mm'); }
  catch { return 'Invalid date'; }
}

function StatCard({
  label, value, icon: Icon, color, loading,
}: {
  label: string; value: string; icon: React.ElementType; color: string; loading: boolean;
}) {
  return (
    <div className={`bg-slate-800/60 border rounded-xl p-5 ${color}`}>
      <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">{label}</p>
      {loading ? (
        <div className="h-8 w-28 bg-slate-700 animate-pulse rounded mt-1" />
      ) : (
        <p className="text-2xl font-bold text-white">{value}</p>
      )}
      <Icon className="w-5 h-5 mt-2 opacity-60" />
    </div>
  );
}

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <tr key={i} className="border-b border-slate-700/40">
          {Array.from({ length: 8 }).map((__, j) => (
            <td key={j} className="px-5 py-4">
              <div className="h-4 bg-slate-700 animate-pulse rounded" style={{ width: `${50 + (j * 13) % 40}%` }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export default function TransactionsPage() {
  const [transactions, setTransactions]   = useState<Transaction[]>([]);
  const [stats, setStats]                 = useState<Stats>({ totalEarnings: 0, totalWithdrawals: 0, downlineEarnings: 0, walletBalance: 0 });
  const [statsLoaded, setStatsLoaded]     = useState(false);
  const [pagination, setPagination]       = useState<PaginationInfo | null>(null);
  const [loading, setLoading]             = useState(true);
  const [activeTab, setActiveTab]         = useState<'all' | 'direct' | 'downline'>('all');
  const [currentPage, setCurrentPage]     = useState(1);
  const [statusFilter, setStatusFilter]   = useState<'all' | 'completed' | 'pending'>('all');
  const abortRef = useRef<AbortController | null>(null);

  const fetchTransactions = useCallback(async (page: number) => {
    // Cancel any in-flight request
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      setLoading(true);
      const url = new URL('/api/transactions', window.location.origin);
      url.searchParams.set('page',       page.toString());
      url.searchParams.set('limit',      '20');
      url.searchParams.set('sourceType', activeTab);
      if (statusFilter !== 'all') url.searchParams.set('status', statusFilter);

      const res  = await fetch(url.toString(), { signal: controller.signal });
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();

      if (data.success) {
        setTransactions(data.data.transactions || []);
        setPagination(data.data.pagination);
        // Stats come from server-side aggregation — accurate across all pages
        if (data.data.stats) {
          setStats(data.data.stats);
          setStatsLoaded(true);
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') console.error('Error fetching transactions:', err);
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
    setStatsLoaded(false);
  };

  const handleStatusChange = (s: typeof statusFilter) => {
    setStatusFilter(s);
    setCurrentPage(1);
    setStatsLoaded(false);
  };

  const fmt = (n: number) => `KES ${n.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Transaction History</h1>
            <p className="text-slate-400 text-sm mt-0.5">All your earnings, payments and withdrawals</p>
          </div>
          <button
            onClick={() => { setStatsLoaded(false); fetchTransactions(currentPage); }}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors disabled:opacity-50 text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Earnings"    value={fmt(stats.totalEarnings)}    icon={TrendingUp}   color="border-green-500/20"  loading={!statsLoaded} />
          <StatCard label="Total Withdrawals" value={fmt(stats.totalWithdrawals)} icon={TrendingDown}  color="border-red-500/20"    loading={!statsLoaded} />
          <StatCard label="Downline Earnings" value={fmt(stats.downlineEarnings)} icon={Users}         color="border-purple-500/20" loading={!statsLoaded} />
          <StatCard label="Wallet Balance"    value={fmt(stats.walletBalance)}    icon={Wallet}        color="border-blue-500/20"   loading={!statsLoaded} />
        </div>

        {/* Filters */}
        <div className="bg-slate-800/50 border border-slate-700/30 rounded-xl p-4 flex flex-col md:flex-row gap-4 items-start md:items-end">
          <div>
            <p className="text-slate-400 text-xs uppercase tracking-wider mb-2">Source</p>
            <div className="flex gap-2 flex-wrap">
              {(['all', 'direct', 'downline'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => handleTabChange(tab)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    activeTab === tab ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {tab === 'all' ? 'All' : tab === 'direct' ? 'Direct' : 'Downline'}
                </button>
              ))}
            </div>
          </div>

          <div className="md:ml-auto">
            <p className="text-slate-400 text-xs uppercase tracking-wider mb-2">Status</p>
            <select
              value={statusFilter}
              onChange={e => handleStatusChange(e.target.value as typeof statusFilter)}
              className="px-3 py-1.5 bg-slate-700 border border-slate-600 text-white rounded-lg text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="all">All Statuses</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="bg-slate-800/50 border border-slate-700/30 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-900/60">
                  {['Date', 'Target User', 'Type', 'Amount', 'Status', 'Description', 'Action', 'References'].map(h => (
                    <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/40">
                {loading ? (
                  <TableSkeleton />
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-16 text-center text-slate-500">
                      No transactions found for the selected filters.
                    </td>
                  </tr>
                ) : (
                  transactions.map(txn => {
                    const isCredit = txn.transaction_type === 'credit';
                    const hasCoop  = txn.coop_reference_id  && txn.coop_reference_id  !== 'N/A';
                    const hasMpesa = txn.mpesa_reference_id && txn.mpesa_reference_id !== 'N/A';
                    return (
                      <tr key={txn.id} className="hover:bg-slate-700/20 transition-colors">
                        {/* Date */}
                        <td className="px-5 py-4 text-slate-400 whitespace-nowrap">
                          {safeDate(txn.date)}
                        </td>
                        {/* Target User */}
                        <td className="px-5 py-4 text-slate-300">
                          {txn.target_user && txn.target_user !== 'N/A' ? txn.target_user : (
                            <span className="text-slate-600 italic">N/A</span>
                          )}
                        </td>
                        {/* Type */}
                        <td className="px-5 py-4">
                          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-700 text-slate-200 whitespace-nowrap">
                            {txn.type_label}
                          </span>
                          {txn.collection === 'chat_foreigners' && (
                            <span className="block text-[10px] text-teal-400 mt-0.5">Chat Foreigners</span>
                          )}
                        </td>
                        {/* Amount */}
                        <td className="px-5 py-4 font-semibold whitespace-nowrap">
                          <span className={isCredit ? 'text-green-400' : 'text-red-400'}>
                            {isCredit ? '+' : '-'}KES {txn.amount.toLocaleString('en-KE', { minimumFractionDigits: 0 })}
                          </span>
                        </td>
                        {/* Status */}
                        <td className="px-5 py-4">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            txn.status === 'completed' ? 'bg-green-900/40 text-green-300' :
                            txn.status === 'failed'    ? 'bg-red-900/40 text-red-300'     :
                                                         'bg-yellow-900/40 text-yellow-300'
                          }`}>
                            {txn.status ? txn.status.charAt(0).toUpperCase() + txn.status.slice(1) : 'Unknown'}
                          </span>
                        </td>
                        {/* Description */}
                        <td className="px-5 py-4 max-w-xs">
                          <p className="text-slate-200 leading-snug">{txn.description}</p>
                          {txn.earning_source_type === 'downline' && txn.downline_level !== 'N/A' && (
                            <p className="text-xs text-purple-400 mt-0.5">Level {txn.downline_level} commission</p>
                          )}
                        </td>
                        {/* Action — last 8 chars of TX id */}
                        <td className="px-5 py-4 font-mono text-xs text-slate-500 whitespace-nowrap">
                          {txn.id ? txn.id.slice(-8).toUpperCase() : 'N/A'}
                        </td>
                        {/* References: Coop bank code OR M-Pesa receipt */}
                        <td className="px-5 py-4 font-mono text-xs whitespace-nowrap">
                          {hasCoop ? (
                            <span className="text-green-400">
                              <span className="text-slate-500 font-sans">Coop:</span> {txn.coop_reference_id}
                            </span>
                          ) : hasMpesa ? (
                            <span className="text-blue-400">
                              <span className="text-slate-500 font-sans">M-Pesa:</span> {txn.mpesa_reference_id}
                            </span>
                          ) : (
                            <span className="text-slate-600 italic font-sans">N/A</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination && (
            <div className="px-5 py-4 border-t border-slate-700/40 flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="text-sm text-slate-400">
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-3 h-3 animate-spin" /> Loading page {pagination.currentPage}...
                  </span>
                ) : (
                  <>
                    Page <span className="text-white font-medium">{pagination.currentPage}</span> of{' '}
                    <span className="text-white font-medium">{pagination.totalPages}</span>
                    <span className="text-slate-500"> &middot; {pagination.totalCount.toLocaleString()} total</span>
                  </>
                )}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={!pagination.hasPrev || loading}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-700 text-slate-300 text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-600 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" /> Prev
                </button>
                <button
                  onClick={() => setCurrentPage(p => p + 1)}
                  disabled={!pagination.hasNext || loading}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-700 text-slate-300 text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-600 transition-colors"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
