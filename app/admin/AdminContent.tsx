'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Users,
  UserCheck,
  ArrowDownUp,
  TrendingUp,
  DollarSign,
  Activity,
  AlertCircle,
  TrendingDown,
  Wallet,
  PieChart,
} from 'lucide-react';

import { getAdminStats, toggleSpinWheel } from '../actions/admin';
import { CardSkeleton, TableRowSkeleton } from '../components/admin/SkeletonLoader';

interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  pendingApprovals: number;
  todayRegistrations: number;
  totalUserTransactions: number;
  totalCompanyTransactions: number;
  companyWalletBalance: number;
  totalCompanyRevenue: number;
  totalCompanyExpenses: number;
  netProfit: number;
  totalUserBalances: number;
  pendingWithdrawalsAmount: number;
  pendingWithdrawalsCount: number;
  revenueBreakdown: {
    activationFees: number;
    unclaimedReferrals: number;
    spinCosts: number;
    contentPayments: number;
    otherRevenue: number;
  };
  expenseBreakdown: {
    userPayouts: number;
    bonuses: number;
    referralCommissions: number;
    spinPrizes: number;
    taskPayments: number;
    surveyPayments: number;
    otherExpenses: number;
  };
  totalReferrals: number;
  spinWheelActive: boolean;
  spinWheelMode: 'manual' | 'scheduled';
}

interface AdminContentProps {
  initialStats: AdminStats;
}

export default function AdminContent({ initialStats }: AdminContentProps) {
  // useState: ephemeral UI state - spin wheel button loading (rule 6)
  const [spinWheelLoading, setSpinWheelLoading] = useState(false);
  // useState: ephemeral UI state - spin status display (rule 6)
  const [spinStatus, setSpinStatus] = useState<{ active: boolean; mode: string }>({
    active: initialStats.spinWheelActive,
    mode: initialStats.spinWheelMode,
  });
  // useState: ephemeral UI state - error message display (rule 6)
  const [error, setError] = useState<string | null>(null);

  // React Query: fetches stats with automatic caching and refetch (rule 2)
  const { data: stats = initialStats, isPending: loading, refetch } = useQuery({
    queryKey: ['adminStats'],
    queryFn: async () => {
      const result = await getAdminStats();
      if (!result.success) {
        throw new Error(result.message);
      }
      return result.data as AdminStats;
    },
    initialData: initialStats,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // React Query: fetches breakdown stats separately (rule 2)
  const { data: breakdownStats, isPending: breakdownLoading } = useQuery({
    queryKey: ['adminBreakdown'],
    queryFn: async () => {
      const response = await fetch('/api/admin/stats/breakdown');
      if (!response.ok) throw new Error('Failed to load breakdown stats');
      const data = await response.json();
      if (data.success) {
        return data.data;
      }
      throw new Error('Invalid response');
    },
  });

  const handleToggleSpinWheel = async (activate: boolean) => {
    try {
      setSpinWheelLoading(true);
      setError(null);
      const result = await toggleSpinWheel(activate);

      if (result.success) {
        setSpinStatus({
          active: activate,
          mode: activate ? 'manual' : 'scheduled',
        });
        // Refetch stats after toggle
        await refetch();
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError('Failed to update spin wheel');
      console.error('Error toggling spin wheel:', err);
    } finally {
      setSpinWheelLoading(false);
    }
  };

  const formatCurrency = (cents: number) => {
    return `KES ${(cents / 100).toLocaleString('en-KE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  const displayStats = breakdownStats
    ? {
        ...stats,
        totalCompanyRevenue: breakdownStats.totalCompanyRevenue,
        totalCompanyExpenses: breakdownStats.totalCompanyExpenses,
        netProfit: breakdownStats.netProfit,
        revenueBreakdown: breakdownStats.revenueBreakdown,
        expenseBreakdown: breakdownStats.expenseBreakdown,
      }
    : stats;

  const profitMargin =
    displayStats.totalCompanyRevenue > 0
      ? ((displayStats.netProfit / displayStats.totalCompanyRevenue) * 100).toFixed(1)
      : '0.0';

  const isProfitable = displayStats.netProfit >= 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600 mt-1">Overview of platform operations and finances</p>
        </div>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          Refresh Data
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="text-red-500 mr-2" size={20} />
            <p className="text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Company Wallet Balance */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <Wallet size={32} />
            <span className="text-blue-100 text-sm font-medium">BALANCE</span>
          </div>
          <div>
            <p className="text-3xl font-bold">
              {formatCurrency(displayStats?.companyWalletBalance || 0)}
            </p>
            <p className="text-blue-100 text-sm mt-1">Company Wallet</p>
          </div>
        </div>

        {/* Total Revenue */}
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <TrendingUp size={32} />
            <span className="text-green-100 text-sm font-medium">REVENUE</span>
          </div>
          <div>
            <p className="text-3xl font-bold">
              {breakdownLoading ? (
                <span className="text-lg">Loading...</span>
              ) : (
                formatCurrency(displayStats?.totalCompanyRevenue || 0)
              )}
            </p>
            <p className="text-green-100 text-sm mt-1">Total Income</p>
          </div>
        </div>

        {/* Total Expenses */}
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <TrendingDown size={32} />
            <span className="text-orange-100 text-sm font-medium">EXPENSES</span>
          </div>
          <div>
            <p className="text-3xl font-bold">
              {breakdownLoading ? (
                <span className="text-lg">Loading...</span>
              ) : (
                formatCurrency(displayStats?.totalCompanyExpenses || 0)
              )}
            </p>
            <p className="text-orange-100 text-sm mt-1">Total Payouts</p>
          </div>
        </div>

        {/* Net Profit */}
        <div
          className={`bg-gradient-to-br ${
            isProfitable ? 'from-emerald-500 to-emerald-600' : 'from-red-500 to-red-600'
          } rounded-lg p-6 text-white shadow-lg`}
        >
          <div className="flex items-center justify-between mb-4">
            <DollarSign size={32} />
            <span className={`${isProfitable ? 'text-emerald-100' : 'text-red-100'} text-sm font-medium`}>
              {isProfitable ? 'PROFIT' : 'LOSS'}
            </span>
          </div>
          <div>
            <p className="text-3xl font-bold">
              {breakdownLoading ? (
                <span className="text-lg">Loading...</span>
              ) : (
                formatCurrency(displayStats?.netProfit || 0)
              )}
            </p>
            <p className={`${isProfitable ? 'text-emerald-100' : 'text-red-100'} text-sm mt-1`}>
              Margin: {profitMargin}%
            </p>
          </div>
        </div>
      </div>

      {/* Liabilities & Obligations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Company Liabilities</h3>
            <AlertCircle className="text-yellow-500" size={24} />
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-gray-600">Total User Balances</span>
              <span className="font-semibold text-gray-900">
                {formatCurrency(displayStats?.totalUserBalances || 0)}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-gray-600">Pending Withdrawals</span>
              <span className="font-semibold text-orange-600">
                {formatCurrency(displayStats?.pendingWithdrawalsAmount || 0)}
                <span className="text-sm text-gray-500 ml-2">
                  ({displayStats?.pendingWithdrawalsCount || 0})
                </span>
              </span>
            </div>
            <div className="flex justify-between items-center py-2 pt-3 border-t-2">
              <span className="font-semibold text-gray-700">Total Liabilities</span>
              <span className="font-bold text-red-600 text-lg">
                {formatCurrency(
                  (displayStats?.totalUserBalances || 0) + (displayStats?.pendingWithdrawalsAmount || 0)
                )}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Financial Health</h3>
            <PieChart className="text-blue-500" size={24} />
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-gray-600">Wallet Balance</span>
              <span className="font-semibold text-blue-600">
                {formatCurrency(displayStats?.companyWalletBalance || 0)}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-gray-600">Total Obligations</span>
              <span className="font-semibold text-red-600">
                {formatCurrency(displayStats?.totalUserBalances || 0)}
              </span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-gray-500 text-sm">Of which pending withdrawal</span>
              <span className="font-semibold text-orange-600 text-sm">
                {formatCurrency(displayStats?.pendingWithdrawalsAmount || 0)}
              </span>
            </div>
            <div className="flex justify-between items-center py-3 pt-3 border-t-2">
              <span className="font-semibold text-gray-700">Net Position</span>
              <span
                className={`font-bold text-lg ${
                  (displayStats?.companyWalletBalance || 0) - (displayStats?.totalUserBalances || 0) >= 0
                    ? 'text-green-600'
                    : 'text-red-600'
                }`}
              >
                {formatCurrency(
                  (displayStats?.companyWalletBalance || 0) - (displayStats?.totalUserBalances || 0)
                )}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Revenue & Expense Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Breakdown */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <TrendingUp className="mr-2 text-green-500" size={20} />
            Revenue Breakdown
            {breakdownLoading && <span className="ml-2 text-xs text-gray-500">Loading...</span>}
          </h3>
          {breakdownLoading ? (
            <TableRowSkeleton />
          ) : (
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-600">Activation Fees</span>
                <span className="font-semibold">
                  {formatCurrency(displayStats?.revenueBreakdown.activationFees || 0)}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-600">Unclaimed Referrals</span>
                <span className="font-semibold">
                  {formatCurrency(displayStats?.revenueBreakdown.unclaimedReferrals || 0)}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-600">Spin Costs</span>
                <span className="font-semibold">
                  {formatCurrency(displayStats?.revenueBreakdown.spinCosts || 0)}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-600">Content Payments</span>
                <span className="font-semibold">
                  {formatCurrency(displayStats?.revenueBreakdown.contentPayments || 0)}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-600">Other Revenue</span>
                <span className="font-semibold">
                  {formatCurrency(displayStats?.revenueBreakdown.otherRevenue || 0)}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 pt-3 border-t-2">
                <span className="font-bold text-gray-800">Total Revenue</span>
                <span className="font-bold text-green-600 text-lg">
                  {formatCurrency(displayStats?.totalCompanyRevenue || 0)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Expense Breakdown */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <TrendingDown className="mr-2 text-orange-500" size={20} />
            Expense Breakdown
            {breakdownLoading && <span className="ml-2 text-xs text-gray-500">Loading...</span>}
          </h3>
          {breakdownLoading ? (
            <TableRowSkeleton />
          ) : (
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-600">User Withdrawals</span>
                <span className="font-semibold">
                  {formatCurrency(displayStats?.expenseBreakdown.userPayouts || 0)}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-600">Bonuses</span>
                <span className="font-semibold">
                  {formatCurrency(displayStats?.expenseBreakdown.bonuses || 0)}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-600">Referral Commissions</span>
                <span className="font-semibold">
                  {formatCurrency(displayStats?.expenseBreakdown.referralCommissions || 0)}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-600">Spin Prizes</span>
                <span className="font-semibold">
                  {formatCurrency(displayStats?.expenseBreakdown.spinPrizes || 0)}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-600">Task Payments</span>
                <span className="font-semibold">
                  {formatCurrency(displayStats?.expenseBreakdown.taskPayments || 0)}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-600">Survey Payments</span>
                <span className="font-semibold">
                  {formatCurrency(displayStats?.expenseBreakdown.surveyPayments || 0)}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-600">Other Expenses</span>
                <span className="font-semibold">
                  {formatCurrency(displayStats?.expenseBreakdown.otherExpenses || 0)}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 pt-3 border-t-2">
                <span className="font-bold text-gray-800">Total Expenses</span>
                <span className="font-bold text-orange-600 text-lg">
                  {formatCurrency(displayStats?.totalCompanyExpenses || 0)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* User & Transaction Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Total Users</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {displayStats.totalUsers.toLocaleString()}
              </p>
            </div>
            <Users className="text-blue-500" size={32} />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Active Users</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {displayStats.activeUsers.toLocaleString()}
              </p>
            </div>
            <Activity className="text-green-500" size={32} />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Pending Approvals</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {displayStats.pendingApprovals.toLocaleString()}
              </p>
            </div>
            <UserCheck className="text-yellow-500" size={32} />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Today Registrations</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {displayStats.todayRegistrations.toLocaleString()}
              </p>
            </div>
            <ArrowDownUp className="text-purple-500" size={32} />
          </div>
        </div>
      </div>

      {/* Spin Wheel Control */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Spin Wheel Control</h3>
            <p className="text-gray-600 text-sm mt-1">
              Current Status: <span className="font-medium">{spinStatus.active ? 'ACTIVE' : 'INACTIVE'}</span>
            </p>
          </div>
          <button
            onClick={() => handleToggleSpinWheel(!spinStatus.active)}
            disabled={spinWheelLoading}
            className={`px-6 py-2 rounded-lg font-semibold transition ${
              spinStatus.active
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-green-600 hover:bg-green-700 text-white'
            } ${spinWheelLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {spinWheelLoading ? 'Updating...' : spinStatus.active ? 'Deactivate' : 'Activate'}
          </button>
        </div>
      </div>
    </div>
  );
}
