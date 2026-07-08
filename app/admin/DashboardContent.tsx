'use client';

import { useState, useEffect } from 'react';
import { Users, UserCheck, DollarSign, TrendingUp, AlertCircle, Wallet, ArrowUpRight, ArrowDownLeft } from 'lucide-react';

interface Stats {
  financials?: {
    totalRevenue: number;
    totalExpenses: number;
    netProfit: number;
    companyBalance: number;
  };
  users?: {
    total: number;
    active: number;
  };
  wallets?: {
    userWalletTotal: number;
    spinWalletTotal: number;
    totalUserFunds: number;
  };
  withdrawals?: {
    pending: {
      count: number;
      amount: number;
    };
  };
}

export default function AdminDashboard() {
  const [financialStats, setFinancialStats] = useState<any>(null);
  const [userStats, setUserStats] = useState<any>(null);
  const [breakdownStats, setBreakdownStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        
        const [financialRes, userRes, breakdownRes] = await Promise.all([
          fetch('/api/admin/stats/financial'),
          fetch('/api/admin/stats/users'),
          fetch('/api/admin/stats/breakdown'),
        ]);

        if (!financialRes.ok || !userRes.ok || !breakdownRes.ok) {
          throw new Error('Failed to fetch stats');
        }

        const financial = await financialRes.json();
        const users = await userRes.json();
        const breakdown = await breakdownRes.json();

        if (financial.success) setFinancialStats(financial.data);
        if (users.success) setUserStats(users.data);
        if (breakdown.success) setBreakdownStats(breakdown.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard');
        console.error('[v0] Dashboard error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    // Refresh every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-gray-200 h-24 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
          <AlertCircle className="text-red-600 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-red-900">Error loading dashboard</h3>
            <p className="text-red-700">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  const financials = financialStats?.financials || {};
  const userMetrics = userStats?.overview || {};
  const wallets = financialStats?.wallets || {};
  const withdrawals = financialStats?.withdrawals?.pending || {};

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-gray-600 text-sm">Real-time platform metrics and financial overview</p>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Company Balance */}
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-600 text-sm">Company Balance</p>
              <p className="text-2xl font-bold mt-2">
                {(financials.companyBalance || 0).toLocaleString('en-US', { style: 'currency', currency: 'KES' })}
              </p>
            </div>
            <Wallet className="text-blue-500" size={24} />
          </div>
        </div>

        {/* Revenue */}
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-600 text-sm">Total Revenue</p>
              <p className="text-2xl font-bold mt-2">
                {(financials.totalRevenue || 0).toLocaleString('en-US', { style: 'currency', currency: 'KES' })}
              </p>
            </div>
            <ArrowUpRight className="text-green-500" size={24} />
          </div>
        </div>

        {/* Expenses */}
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-red-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-600 text-sm">Total Expenses</p>
              <p className="text-2xl font-bold mt-2">
                {(financials.totalExpenses || 0).toLocaleString('en-US', { style: 'currency', currency: 'KES' })}
              </p>
            </div>
            <ArrowDownLeft className="text-red-500" size={24} />
          </div>
        </div>

        {/* Profit */}
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-600 text-sm">Net Profit</p>
              <p className="text-2xl font-bold mt-2">
                {(financials.netProfit || 0).toLocaleString('en-US', { style: 'currency', currency: 'KES' })}
              </p>
            </div>
            <TrendingUp className="text-purple-500" size={24} />
          </div>
        </div>
      </div>

      {/* User Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-600 text-sm">Total Users</p>
              <p className="text-2xl font-bold mt-2">{userMetrics.totalUsers?.toLocaleString() || 0}</p>
            </div>
            <Users className="text-blue-500" size={24} />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-600 text-sm">Active Today</p>
              <p className="text-2xl font-bold mt-2">{userMetrics.activeToday?.toLocaleString() || 0}</p>
            </div>
            <UserCheck className="text-green-500" size={24} />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-600 text-sm">Pending Approvals</p>
              <p className="text-2xl font-bold mt-2">{userMetrics.pending || 0}</p>
            </div>
            <AlertCircle className="text-orange-500" size={24} />
          </div>
        </div>
      </div>

      {/* Wallet & Withdrawal Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="font-semibold mb-4">User Wallets</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Main Wallet</span>
              <span className="font-semibold">
                {(wallets.userWalletTotal || 0).toLocaleString('en-US', { style: 'currency', currency: 'KES' })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Spin Wallet</span>
              <span className="font-semibold">
                {(wallets.spinWalletTotal || 0).toLocaleString('en-US', { style: 'currency', currency: 'KES' })}
              </span>
            </div>
            <div className="border-t pt-3 flex justify-between font-bold">
              <span>Total User Funds</span>
              <span>
                {(wallets.totalUserFunds || 0).toLocaleString('en-US', { style: 'currency', currency: 'KES' })}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="font-semibold mb-4">Pending Withdrawals</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Count</span>
              <span className="font-semibold">{withdrawals.count || 0} requests</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Total Amount</span>
              <span className="font-semibold">
                {(withdrawals.amount || 0).toLocaleString('en-US', { style: 'currency', currency: 'KES' })}
              </span>
            </div>
            <div className="border-t pt-3">
              <a href="/admin/withdrawals" className="text-blue-600 hover:underline text-sm font-semibold">
                View All Withdrawals →
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Revenue & Expense Breakdown */}
      {breakdownStats && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold mb-4">Revenue Breakdown</h3>
            <div className="space-y-2 text-sm">
              {Object.entries(breakdownStats.revenueBreakdown || {}).map(([key, val]: [string, any]) => (
                <div key={key} className="flex justify-between">
                  <span className="text-gray-600 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                  <span className="font-semibold">
                    {(val.amount || 0).toLocaleString('en-US', { style: 'currency', currency: 'KES' })}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold mb-4">Expense Breakdown</h3>
            <div className="space-y-2 text-sm">
              {Object.entries(breakdownStats.expenseBreakdown || {}).map(([key, val]: [string, any]) => (
                <div key={key} className="flex justify-between">
                  <span className="text-gray-600 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                  <span className="font-semibold">
                    {(val.amount || 0).toLocaleString('en-US', { style: 'currency', currency: 'KES' })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
