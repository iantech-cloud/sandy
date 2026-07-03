'use client';

import { useState } from 'react';
import {
  Building2,
  Wallet,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  Download,
  RefreshCw,
  Edit,
  Check,
  X,
  AlertCircle,
  BarChart3,
  PieChart as PieChartIcon,
  Activity,
  CreditCard,
  FileText,
  Users,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  Database,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getCompanyProfile,
  getCompanyTransactions,
  getRevenueBreakdown,
  updateCompanyInfo,
  exportCompanyReport,
  syncCompanyFinancials,
} from '@/app/actions/company';
import { toast } from 'sonner';

interface CompanyData {
  _id: string;
  name: string;
  email: string;
  phone_number: string;
  wallet_balance: number;
  total_revenue: number;
  total_expenses: number;
  activation_revenue: number;
  unclaimed_referral_revenue: number;
  content_payment_revenue: number;
  spin_cost_revenue: number;
  other_revenue: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

interface CompanyStats {
  total_revenue: number;
  total_expenses: number;
  net_profit: number;
  current_balance: number;
  transactions_count: number;
  activation_count: number;
  referral_bonus_count: number;
  today_revenue: number;
  this_week_revenue: number;
  this_month_revenue: number;
}

interface Transaction {
  _id: string;
  amount: number;
  type: string;
  description: string;
  status: string;
  source: string;
  balance_before: number;
  balance_after: number;
  created_at: Date;
  metadata?: any;
}

interface RevenueCategory {
  name: string;
  amount: number;
  percentage: number;
  color: string;
}

interface AdminCompanyContentProps {
  initialCompany: CompanyData | null;
  initialStats: CompanyStats | null;
  initialTransactions: Transaction[];
  initialRevenueBreakdown: { categories: RevenueCategory[]; total: number } | null;
}

export function AdminCompanyContent({
  initialCompany,
  initialStats,
  initialTransactions,
  initialRevenueBreakdown,
}: AdminCompanyContentProps) {
  const queryClient = useQueryClient();

  // Ephemeral UI state only (rule 6)
  const [isEditing, setIsEditing] = useState(false);
  const [editedInfo, setEditedInfo] = useState<Partial<CompanyData> | null>(null);
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });

  // React Query: Replace useState(company) + useEffect (rule 2)
  const { data: company = initialCompany, isLoading: companyLoading } = useQuery({
    queryKey: ['company-profile'],
    queryFn: () => getCompanyProfile(),
    initialData: initialCompany,
    select: (data) => data.data,
  });

  // React Query: Replace useState(stats) + useEffect (rule 2)
  const { data: stats = initialStats, isLoading: statsLoading } = useQuery({
    queryKey: ['company-stats'],
    queryFn: () => getCompanyProfile(),
    initialData: initialStats,
    select: (data) => ({
      total_revenue: data.data?.total_revenue || 0,
      total_expenses: data.data?.total_expenses || 0,
      net_profit: (data.data?.total_revenue || 0) - (data.data?.total_expenses || 0),
      current_balance: data.data?.wallet_balance || 0,
      transactions_count: 0,
      activation_count: 0,
      referral_bonus_count: 0,
      today_revenue: 0,
      this_week_revenue: 0,
      this_month_revenue: 0,
    } as CompanyStats),
  });

  // React Query: Replace useState(transactions) + useEffect (rule 2)
  const { data: transactions = initialTransactions, isLoading: transactionsLoading } = useQuery({
    queryKey: ['company-transactions', dateRange],
    queryFn: () => getCompanyTransactions(),
    initialData: initialTransactions,
    select: (data) => data.data || [],
  });

  // React Query: Replace useState(revenueBreakdown) + useEffect (rule 2)
  const { data: revenueBreakdown = initialRevenueBreakdown } = useQuery({
    queryKey: ['revenue-breakdown'],
    queryFn: () => getRevenueBreakdown(),
    initialData: initialRevenueBreakdown,
    select: (data) => data.data,
  });

  // Mutations
  const updateMutation = useMutation({
    mutationFn: (updates: Partial<CompanyData>) => updateCompanyInfo(updates),
    onSuccess: (result) => {
      if (result.success) {
        toast.success('Company info updated');
        setIsEditing(false);
        setEditedInfo(null);
        queryClient.invalidateQueries({ queryKey: ['company-profile'] });
      } else {
        toast.error(result.error || 'Failed to update');
      }
    },
  });

  const syncMutation = useMutation({
    mutationFn: () => syncCompanyFinancials(),
    onSuccess: (result) => {
      if (result.success) {
        toast.success('Financials synced');
        queryClient.invalidateQueries({ queryKey: ['company-stats'] });
        queryClient.invalidateQueries({ queryKey: ['company-profile'] });
      } else {
        toast.error(result.error || 'Failed to sync');
      }
    },
  });

  const exportMutation = useMutation({
    mutationFn: (reportType: string) => exportCompanyReport(reportType),
    onSuccess: (result) => {
      if (result.success) {
        toast.success('Report exported');
      } else {
        toast.error(result.error || 'Failed to export');
      }
    },
  });

  const handleSaveInfo = () => {
    if (editedInfo) {
      updateMutation.mutate(editedInfo);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditedInfo(null);
  };

  const formatCurrency = (value: number) => {
    return `KES ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Company Dashboard</h1>
          <p className="text-gray-600 mt-1">Monitor company finances and performance</p>
        </div>
        <button
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          <Database className="w-4 h-4" />
          {syncMutation.isPending ? 'Syncing...' : 'Sync Financials'}
        </button>
      </div>

      {/* Company Info Section */}
      {company && (
        <div className="bg-white rounded-lg border p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Company Information
            </h2>
            <button
              onClick={() => {
                if (isEditing) {
                  handleCancel();
                } else {
                  setIsEditing(true);
                  setEditedInfo(company);
                }
              }}
              className="px-3 py-1 rounded text-sm hover:bg-gray-100"
            >
              {isEditing ? 'Cancel' : 'Edit'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              {isEditing ? (
                <input
                  type="text"
                  value={editedInfo?.name || ''}
                  onChange={(e) => setEditedInfo({ ...editedInfo, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                />
              ) : (
                <p className="text-gray-900">{company.name}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              {isEditing ? (
                <input
                  type="email"
                  value={editedInfo?.email || ''}
                  onChange={(e) => setEditedInfo({ ...editedInfo, email: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                />
              ) : (
                <p className="text-gray-900">{company.email}</p>
              )}
            </div>
          </div>

          {isEditing && (
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleSaveInfo}
                disabled={updateMutation.isPending}
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                {updateMutation.isPending ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={handleCancel}
                className="px-4 py-2 bg-gray-300 text-gray-900 rounded hover:bg-gray-400 flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-lg border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Current Balance</span>
              <Wallet className="w-5 h-5 text-blue-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.current_balance)}</p>
          </div>

          <div className="bg-white p-6 rounded-lg border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Total Revenue</span>
              <TrendingUp className="w-5 h-5 text-green-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.total_revenue)}</p>
          </div>

          <div className="bg-white p-6 rounded-lg border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Total Expenses</span>
              <TrendingDown className="w-5 h-5 text-red-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.total_expenses)}</p>
          </div>

          <div className="bg-white p-6 rounded-lg border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Net Profit</span>
              <DollarSign className="w-5 h-5 text-yellow-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.net_profit)}</p>
          </div>
        </div>
      )}

      {/* Transactions */}
      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Recent Transactions
        </h2>

        {transactionsLoading ? (
          <div className="p-8 text-center text-gray-500">Loading transactions...</div>
        ) : transactions.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No transactions found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold">Date</th>
                  <th className="px-4 py-2 text-left font-semibold">Description</th>
                  <th className="px-4 py-2 text-left font-semibold">Type</th>
                  <th className="px-4 py-2 text-left font-semibold">Amount</th>
                  <th className="px-4 py-2 text-left font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {transactions.map((txn: Transaction) => (
                  <tr key={txn._id}>
                    <td className="px-4 py-3">{formatDate(txn.created_at)}</td>
                    <td className="px-4 py-3">{txn.description}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        txn.type === 'credit' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {txn.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold">{formatCurrency(txn.amount)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        txn.status === 'completed' ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {txn.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
