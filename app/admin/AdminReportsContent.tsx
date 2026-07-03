'use client';

import { useState } from 'react';
import {
  Download,
  TrendingUp,
  TrendingDown,
  DollarSign,
  BarChart3,
  Calendar,
  RefreshCw,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

interface FinancialReport {
  incomeStatement: {
    revenue: number;
    expenses: number;
    netIncome: number;
    period: string;
    breakdown: {
      activationFees: number;
      companyRevenue: number;
      unclaimedReferrals: number;
      withdrawals: number;
      bonuses: number;
      taskPayments: number;
      referralBonuses: number;
      surveyPayments: number;
      spinWins: number;
    };
  };
  balanceSheet: {
    assets: number;
    liabilities: number;
    equity: number;
    date: string;
    breakdown: {
      cash: number;
      userDeposits: number;
      userBalances: number;
      pendingWithdrawals: number;
      companyEquity: number;
    };
  };
  cashFlow: {
    operating: number;
    investing: number;
    financing: number;
    netChange: number;
    period: string;
    breakdown: {
      cashFromOperations: number;
      cashFromInvesting: number;
      cashFromFinancing: number;
    };
  };
  equityStatement: {
    beginningEquity: number;
    netIncome: number;
    deposits: number;
    withdrawals: number;
    endingEquity: number;
    period: string;
  };
  accountsReceivable: Array<{
    customer: string;
    invoice: string;
    amount: number;
    dueDate: string;
    status: 'current' | '30_days' | '60_days' | '90_days' | 'over_90_days';
    daysOverdue: number;
  }>;
  userMetrics: {
    totalUsers: number;
    activeUsers: number;
    totalDeposits: number;
    totalWithdrawals: number;
    averageBalance: number;
    depositRate: number;
  };
  periodMetrics: {
    startDate: string;
    endDate: string;
    transactionCount: number;
    totalDepositsPeriod: number;
    totalWithdrawalsPeriod: number;
  };
  companyMetrics?: {
    companyWalletBalance: number;
    totalCompanyRevenue: number;
    totalCompanyExpenses: number;
    activationRevenue: number;
    unclaimedReferralRevenue: number;
  };
}

interface AdminReportsContentProps {
  initialReports: FinancialReport | null;
}

export function AdminReportsContent({ initialReports }: AdminReportsContentProps) {
  // Ephemeral UI state only (rule 6)
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });

  // React Query: Replace useState(reports) + useEffect (rule 2)
  const { data: reports = initialReports, isLoading, error, refetch } = useQuery({
    queryKey: ['financial-reports', dateRange],
    queryFn: async () => {
      const response = await fetch(
        `/api/admin/reports?start=${dateRange.start}&end=${dateRange.end}`
      );

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(`Server returned ${response.status}: ${text.substring(0, 100)}`);
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `HTTP error! status: ${response.status}`);
      }

      if (data.success) {
        return data.data;
      } else {
        throw new Error(data.message || 'Failed to fetch reports');
      }
    },
    initialData: initialReports,
  });

  const exportReport = (reportType: string) => {
    // Placeholder export logic
    console.log(`Exporting ${reportType} report`);
  };

  const handleDateChange = (type: 'start' | 'end', value: string) => {
    setDateRange({ ...dateRange, [type]: value });
  };

  if (error) {
    return (
      <div className="p-8 bg-red-50 border border-red-200 rounded">
        <h2 className="text-red-800 font-bold">Error Loading Reports</h2>
        <p className="text-red-600 mt-2">
          {error instanceof Error ? error.message : 'Failed to load financial reports'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Financial Reports</h1>
        <button
          onClick={() => refetch()}
          disabled={isLoading}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          {isLoading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Date Range Selector */}
      <div className="bg-white p-6 rounded-lg border space-y-4">
        <h2 className="font-bold flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Date Range
        </h2>
        <div className="flex gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Start Date</label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => handleDateChange('start', e.target.value)}
              className="px-3 py-2 border rounded"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">End Date</label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => handleDateChange('end', e.target.value)}
              className="px-3 py-2 border rounded"
            />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-gray-500">Loading reports...</div>
      ) : reports ? (
        <div className="space-y-6">
          {/* Income Statement */}
          {reports.incomeStatement && (
            <div className="bg-white p-6 rounded-lg border">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Income Statement
              </h2>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Revenue</p>
                  <p className="text-2xl font-bold text-green-600">
                    ${reports.incomeStatement.revenue.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Expenses</p>
                  <p className="text-2xl font-bold text-red-600">
                    ${reports.incomeStatement.expenses.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Net Income</p>
                  <p
                    className={`text-2xl font-bold ${
                      reports.incomeStatement.netIncome >= 0
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}
                  >
                    ${reports.incomeStatement.netIncome.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Balance Sheet */}
          {reports.balanceSheet && (
            <div className="bg-white p-6 rounded-lg border">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Balance Sheet
              </h2>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Assets</p>
                  <p className="text-2xl font-bold">
                    ${reports.balanceSheet.assets.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Liabilities</p>
                  <p className="text-2xl font-bold">
                    ${reports.balanceSheet.liabilities.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Equity</p>
                  <p className="text-2xl font-bold">
                    ${reports.balanceSheet.equity.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Cash Flow */}
          {reports.cashFlow && (
            <div className="bg-white p-6 rounded-lg border">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                {reports.cashFlow.netChange >= 0 ? (
                  <TrendingUp className="w-5 h-5 text-green-600" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-red-600" />
                )}
                Cash Flow
              </h2>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Operating</p>
                  <p className="text-2xl font-bold">
                    ${reports.cashFlow.operating.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Investing</p>
                  <p className="text-2xl font-bold">
                    ${reports.cashFlow.investing.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Financing</p>
                  <p className="text-2xl font-bold">
                    ${reports.cashFlow.financing.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Export Buttons */}
          <div className="flex gap-2">
            {['income', 'balance', 'cashFlow', 'equity'].map((type) => (
              <button
                key={type}
                onClick={() => exportReport(type)}
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export {type}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="p-8 text-center text-gray-500">No reports available</div>
      )}
    </div>
  );
}
