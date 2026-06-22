// app/admin/transactions/page.tsx
"use client";

import { useState, useEffect } from 'react';
import { Download, Search, RefreshCw, TrendingUp, TrendingDown, DollarSign, Building2, Users, ChevronLeft, ChevronRight, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { updateTransactionStatus, bulkUpdateTransactionStatus } from '@/app/actions/admin';

interface Transaction {
  id: string;
  user_id: string;
  user_email: string;
  user_username: string;
  amount: number;
  amount_cents: number;
  transaction_type: 'credit' | 'debit';
  source: string;
  earning_source_type: 'direct' | 'downline' | 'system';
  status: 'pending' | 'completed' | 'failed' | 'cancelled' | 'timeout';
  description: string;
  date: string;
  payment_method?: string;
  coop_reference_id?: string;
  mpesa_reference_id?: string;
  coop_bank_transaction_id?: string;
  referrer_id?: string;
  referrer_email?: string;
  referrer_username?: string;
  downline_user_id?: string;
  downline_user_email?: string;
  downline_level?: number;
  commission_percentage?: number;
  metadata?: any;
}

interface Stats {
  totalTransactions: number;
  userTransactions: number;
  companyTransactions: number;
  userPayments: number;
  companyRevenue: number;
  pendingCount: number;
  completedCount: number;
  failedCount: number;
  cancelledCount: number;
  timeoutCount: number;
}

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<{[key: string]: boolean}>({});
  const [stats, setStats] = useState<Stats>({
    totalTransactions: 0,
    userTransactions: 0,
    companyTransactions: 0,
    userPayments: 0,
    companyRevenue: 0,
    pendingCount: 0,
    completedCount: 0,
    failedCount: 0,
    cancelledCount: 0,
    timeoutCount: 0
  });
  
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  });

  const [filters, setFilters] = useState({
    search: '',
    source: 'all',
    sourceType: 'all', // 'all', 'direct', 'downline'
    status: 'all',
    coopRef: '',
    mpesaRef: '',
    dateFrom: '',
    dateTo: ''
  });

  // Bulk operations state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<'pending' | 'completed' | 'failed' | 'cancelled' | 'timeout' | null>(null);
  const [bulkReason, setBulkReason] = useState('');
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // Individual status update state
  const [updateModal, setUpdateModal] = useState<{
    isOpen: boolean;
    transactionId?: string;
    currentStatus?: string;
    newStatus?: 'pending' | 'completed' | 'failed' | 'cancelled' | 'timeout' | null;
    reason?: string;
  }>({ isOpen: false });

  useEffect(() => {
    fetchTransactions();
  }, [pagination.page, filters]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams();
      params.append('limit', pagination.limit.toString());
      params.append('page', pagination.page.toString());
      if (filters.source !== 'all') params.append('source', filters.source);
      if (filters.sourceType !== 'all') params.append('sourceType', filters.sourceType);
      if (filters.status !== 'all') params.append('status', filters.status);
      if (filters.coopRef) params.append('coopRef', filters.coopRef);
      if (filters.mpesaRef) params.append('mpesaRef', filters.mpesaRef);
      if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.append('dateTo', filters.dateTo);

      const response = await fetch(`/api/admin/transactions?${params}`);
      const data = await response.json();
      
      if (data.success) {
        setTransactions(data.data.transactions);
        if (data.data.pagination) {
          setPagination(data.data.pagination);
        }
        setSelectedIds(new Set()); // Clear selections on fetch
        
        // Fetch ALL transactions (without pagination) for stats calculation across all pages
        fetchAllTransactionsForStats();
      } else {
        console.error('Failed to fetch transactions:', data.message);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllTransactionsForStats = async () => {
    try {
      // Fetch all transactions with a high limit to get complete data for stats
      const params = new URLSearchParams();
      params.append('limit', '10000'); // Fetch up to 10k transactions for stats
      params.append('page', '1');
      
      // Apply the same filters as current page
      if (filters.source !== 'all') params.append('source', filters.source);
      if (filters.sourceType !== 'all') params.append('sourceType', filters.sourceType);
      if (filters.status !== 'all') params.append('status', filters.status);
      if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.append('dateTo', filters.dateTo);

      const response = await fetch(`/api/admin/transactions?${params}`);
      const data = await response.json();
      
      if (data.success && data.data.transactions) {
        // Calculate stats from ALL transactions (all pages)
        calculateStats(data.data.transactions);
      }
    } catch (error) {
      console.error('Error fetching all transactions for stats:', error);
    }
  };

  const calculateStats = (txns: Transaction[]) => {
    const completedTxns = txns.filter(t => t.status === 'completed');
    
    // Categorize transactions by type
    const creditTxns = completedTxns.filter(t => t.transaction_type === 'credit');
    const debitTxns = completedTxns.filter(t => t.transaction_type === 'debit');
    
    const directEarnings = creditTxns
      .filter(t => t.earning_source_type === 'direct')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const downlineEarnings = creditTxns
      .filter(t => t.earning_source_type === 'downline')
      .reduce((sum, t) => sum + t.amount, 0);
    
    setStats({
      totalTransactions: txns.length,
      userTransactions: creditTxns.length,
      companyTransactions: debitTxns.length,
      userPayments: directEarnings,
      companyRevenue: downlineEarnings,
      pendingCount: txns.filter(t => t.status === 'pending').length,
      completedCount: txns.filter(t => t.status === 'completed').length,
      failedCount: txns.filter(t => t.status === 'failed').length,
      cancelledCount: txns.filter(t => t.status === 'cancelled').length,
      timeoutCount: txns.filter(t => t.status === 'timeout').length
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 border border-green-200';
      case 'pending': return 'bg-yellow-100 text-yellow-800 border border-yellow-200';
      case 'failed': return 'bg-red-100 text-red-800 border border-red-200';
      case 'cancelled': return 'bg-gray-100 text-gray-800 border border-gray-200';
      case 'timeout': return 'bg-orange-100 text-orange-800 border border-orange-200';
      default: return 'bg-gray-100 text-gray-800 border border-gray-200';
    }
  };

  const getTypeColor = (type: string, targetType: string) => {
    if (targetType === 'company' && ['COMPANY_REVENUE', 'UNCLAIMED_REFERRAL', 'SPIN_COST'].includes(type)) {
      return 'text-green-600';
    }
    if (targetType === 'user' && ['REFERRAL', 'BONUS', 'TASK_PAYMENT', 'SURVEY', 'SPIN_WIN', 'SPIN_WALLET_DEPOSIT'].includes(type)) {
      return 'text-red-600';
    }
    if (type === 'DEPOSIT') {
      return 'text-green-600';
    }
    if (type === 'WITHDRAWAL') {
      return 'text-red-600';
    }
    return 'text-gray-600';
  };

  const getTargetBadge = (targetType: string) => {
    if (targetType === 'company') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
          <Building2 className="w-3 h-3" />
          Company
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200">
        <Users className="w-3 h-3" />
        User
      </span>
    );
  };

  // Handle row checkbox selection
  const toggleRowSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  // Select all eligible transactions (those with mpesa_transaction_id)
  const toggleSelectAll = () => {
    const eligibleIds = transactions
      .filter(t => t.mpesa_transaction_id)
      .map(t => t.id);
    
    if (selectedIds.size === eligibleIds.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(eligibleIds));
    }
  };

  // Check if transaction is eligible for bulk operations
  const isEligible = (txn: Transaction) => !!txn.mpesa_transaction_id;

  // Handle individual transaction update
  const handleSingleUpdate = async () => {
    if (!updateModal.transactionId || !updateModal.newStatus) return;

    try {
      setUpdating(prev => ({...prev, [updateModal.transactionId!]: true}));
      
      const result = await updateTransactionStatus(
        updateModal.transactionId,
        updateModal.newStatus,
        updateModal.reason
      );

      if (result.success) {
        alert('Transaction updated successfully');
        fetchTransactions();
        setUpdateModal({ isOpen: false });
      } else {
        alert('Error: ' + result.message);
      }
    } catch (error) {
      console.error('Error updating transaction:', error);
      alert('Failed to update transaction');
    } finally {
      setUpdating(prev => ({...prev, [updateModal.transactionId!]: false}));
    }
  };

  // Handle bulk transaction update
  const handleBulkUpdate = async () => {
    if (selectedIds.size === 0 || !bulkStatus) return;

    try {
      setBulkProcessing(true);
      
      const result = await bulkUpdateTransactionStatus(
        Array.from(selectedIds),
        bulkStatus,
        bulkReason
      );

      if (result.success) {
        alert(`${result.data?.updated} transactions updated, ${result.data?.failed} failed`);
        fetchTransactions();
        setShowBulkModal(false);
        setBulkStatus(null);
        setBulkReason('');
      } else {
        alert('Error: ' + result.message);
      }
    } catch (error) {
      console.error('Error bulk updating transactions:', error);
      alert('Failed to bulk update transactions');
    } finally {
      setBulkProcessing(false);
    }
  };

  const exportToCSV = () => {
    const headers = [
      'Date', 'Transaction Code', 'Target Type', 'User', 'Type', 
      'Amount', 'Status', 'Description', 'M-Pesa Receipt', 'Phone Number'
    ];
    const rows = transactions.map(t => [
      new Date(t.date).toLocaleString(),
      t.transaction_code || 'N/A',
      t.target_type,
      `${t.user_username || 'N/A'} (${t.user_email || 'N/A'})`,
      t.type,
      t.amount.toFixed(2),
      t.status,
      t.description,
      t.mpesa_receipt_number || 'N/A',
      t.phone_number || 'N/A'
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="animate-spin h-8 w-8 text-blue-600 mx-auto mb-2" />
          <p className="text-gray-600">Loading transactions...</p>
        </div>
      </div>
    );
  }

  const eligibleCount = transactions.filter(t => isEligible(t)).length;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Transaction Management</h1>
          <p className="text-gray-600 mt-1">Monitor all platform transactions (User & Company)</p>
        </div>
        <button
          onClick={fetchTransactions}
          className="bg-blue-600 text-white rounded-lg px-4 py-2 hover:bg-blue-700 flex items-center gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Company Revenue</p>
              <p className="text-2xl font-bold text-green-600">KES {stats.companyRevenue.toFixed(2)}</p>
              <p className="text-xs text-gray-500 mt-1">{stats.companyTransactions} transactions</p>
            </div>
            <Building2 className="h-10 w-10 text-green-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-red-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">User Payments (Expenses)</p>
              <p className="text-2xl font-bold text-red-600">KES {stats.userPayments.toFixed(2)}</p>
              <p className="text-xs text-gray-500 mt-1">{stats.userTransactions} transactions</p>
            </div>
            <Users className="h-10 w-10 text-red-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Net Profit</p>
              <p className={`text-2xl font-bold ${stats.companyRevenue - stats.userPayments >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                KES {(stats.companyRevenue - stats.userPayments).toFixed(2)}
              </p>
              <p className="text-xs text-gray-500 mt-1">Revenue - Expenses</p>
            </div>
            <DollarSign className="h-10 w-10 text-blue-500" />
          </div>
        </div>
      </div>

      {/* Status Summary */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">Transaction Status Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <p className="text-2xl font-bold text-gray-900">{stats.totalTransactions}</p>
            <p className="text-sm text-gray-600">Total</p>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <p className="text-2xl font-bold text-green-600">{stats.completedCount}</p>
            <p className="text-sm text-gray-600">Completed</p>
          </div>
          <div className="text-center p-3 bg-yellow-50 rounded-lg">
            <p className="text-2xl font-bold text-yellow-600">{stats.pendingCount}</p>
            <p className="text-sm text-gray-600">Pending</p>
          </div>
          <div className="text-center p-3 bg-red-50 rounded-lg">
            <p className="text-2xl font-bold text-red-600">{stats.failedCount}</p>
            <p className="text-sm text-gray-600">Failed</p>
          </div>
          <div className="text-center p-3 bg-orange-50 rounded-lg">
            <p className="text-2xl font-bold text-orange-600">{stats.timeoutCount}</p>
            <p className="text-sm text-gray-600">Timeout</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">Filters</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
            <select
              value={filters.source}
              onChange={(e) => {
                setFilters({...filters, source: e.target.value});
                setPagination({...pagination, page: 1});
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Sources</option>
              <option value="freelance_payment">Freelance Payment</option>
              <option value="subscription_earnings">Subscription</option>
              <option value="digital_product_sale">Digital Products</option>
              <option value="tutoring">Tutoring</option>
              <option value="ai_task">AI Tasks</option>
              <option value="local_gig">Local Gigs</option>
              <option value="referral_bonus">Referral Bonus</option>
              <option value="downline_commission">Downline Commission</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Earning Source</label>
            <select
              value={filters.sourceType}
              onChange={(e) => {
                setFilters({...filters, sourceType: e.target.value});
                setPagination({...pagination, page: 1});
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Types</option>
              <option value="direct">Direct Earnings</option>
              <option value="downline">Downline Commissions</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => {
                setFilters({...filters, status: e.target.value});
                setPagination({...pagination, page: 1});
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Coop Reference</label>
            <input
              type="text"
              placeholder="Search Coop Ref..."
              value={filters.coopRef}
              onChange={(e) => {
                setFilters({...filters, coopRef: e.target.value});
                setPagination({...pagination, page: 1});
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">M-Pesa Reference</label>
            <input
              type="text"
              placeholder="Search M-Pesa Ref..."
              value={filters.mpesaRef}
              onChange={(e) => {
                setFilters({...filters, mpesaRef: e.target.value});
                setPagination({...pagination, page: 1});
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Bulk Actions Bar - TEMPORARILY DISABLED */}
      {false && selectedIds.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-blue-600" />
            <span className="font-medium text-blue-900">{selectedIds.size} transaction(s) selected</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowBulkModal(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium"
            >
              Update Status
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="bg-gray-300 text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-400 font-medium"
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* Transactions Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
        <div className="flex items-center justify-between p-6 border-b">
          <h3 className="text-lg font-semibold">Transactions ({pagination.total} total)</h3>
          <button
            onClick={exportToCSV}
            className="bg-green-600 text-white rounded-lg px-4 py-2 hover:bg-green-700 flex items-center gap-2 text-sm"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                  {/* Checkboxes disabled temporarily - bulk operations disabled */}
                  <div className="w-5"></div>
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Date</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Target</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">User</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Type</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Amount</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Description</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                    No transactions found
                  </td>
                </tr>
              ) : (
                transactions.map((txn) => (
                  <tr key={txn.id} className={`border-b hover:bg-gray-50 ${!isEligible(txn) ? 'bg-gray-50' : ''}`}>
                    <td className="px-4 py-3">
                      {/* Checkboxes disabled temporarily */}
                      <div className="w-5"></div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {new Date(txn.date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {getTargetBadge(txn.target_type)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="font-medium text-gray-900">{txn.user_username || 'N/A'}</div>
                      <div className="text-xs text-gray-500">{txn.user_email || 'N/A'}</div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`font-medium ${getTypeColor(txn.type, txn.target_type)}`}>
                        {txn.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-semibold">
                      KES {txn.amount.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(txn.status)}`}>
                        {txn.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-xs">
                      <div>
                        {txn.description}
                        {txn.mpesa_receipt_number && (
                          <span className="block text-xs text-blue-600 mt-1">
                            M-Pesa: {txn.mpesa_receipt_number}
                          </span>
                        )}
                        {txn.phone_number && (
                          <span className="block text-xs text-gray-500 mt-1">
                            Phone: {txn.phone_number}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {/* Update action temporarily disabled */}
                      <span className="text-xs text-gray-400">
                        —
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-6 py-4 border-t flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Page {pagination.page} of {pagination.pages} ({pagination.total} total)
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPagination({...pagination, page: Math.max(1, pagination.page - 1)})}
              disabled={pagination.page === 1}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </button>
            <button
              onClick={() => setPagination({...pagination, page: Math.min(pagination.pages, pagination.page + 1)})}
              disabled={pagination.page === pagination.pages}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Single Status Update Modal - TEMPORARILY DISABLED */}
      {false && updateModal.isOpen && updateModal.transactionId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">Update Transaction Status</h2>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Current Status</label>
              <div className="px-3 py-2 bg-gray-100 rounded-lg text-gray-900 font-medium">
                {updateModal.currentStatus}
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">New Status</label>
              <select
                value={updateModal.newStatus || ''}
                onChange={(e) => setUpdateModal({
                  ...updateModal,
                  newStatus: (e.target.value as any) || null
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select status...</option>
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
                <option value="cancelled">Cancelled</option>
                <option value="timeout">Timeout</option>
              </select>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Reason (Optional)</label>
              <textarea
                value={updateModal.reason || ''}
                onChange={(e) => setUpdateModal({...updateModal, reason: e.target.value})}
                placeholder="Explain the reason for this status change..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={3}
              />
            </div>

            {updateModal.newStatus === 'failed' && updateModal.currentStatus === 'completed' && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800 font-medium">Warning: User balance will be reversed</p>
                <p className="text-xs text-red-700 mt-1">Since this transaction was completed, marking it as failed will deduct the amount from the user's balance.</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setUpdateModal({ isOpen: false })}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSingleUpdate}
                disabled={!updateModal.newStatus || updating[updateModal.transactionId]}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
              >
                {updating[updateModal.transactionId] ? 'Updating...' : 'Update'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Status Update Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">Bulk Update Status</h2>
            
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-4">Update status for {selectedIds.size} transaction(s)</p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">New Status</label>
              <select
                value={bulkStatus || ''}
                onChange={(e) => setBulkStatus((e.target.value as any) || null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select status...</option>
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
                <option value="cancelled">Cancelled</option>
                <option value="timeout">Timeout</option>
              </select>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Reason (Optional)</label>
              <textarea
                value={bulkReason}
                onChange={(e) => setBulkReason(e.target.value)}
                placeholder="Explain the reason for this bulk update..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={3}
              />
            </div>

            {bulkStatus === 'failed' && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800 font-medium">Warning: Balance Reversals</p>
                <p className="text-xs text-red-700 mt-1">User balances will be reversed for all completed transactions being marked as failed.</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowBulkModal(false);
                  setBulkStatus(null);
                  setBulkReason('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkUpdate}
                disabled={!bulkStatus || bulkProcessing}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
              >
                {bulkProcessing ? 'Updating...' : 'Update All'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
