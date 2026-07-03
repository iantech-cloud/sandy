import { Suspense } from 'react';
import { AdminReportsContent } from '../AdminReportsContent';
import { Loader2 } from 'lucide-react';

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

async function getInitialReports() {
  // Server-side fetch: no useState, no useEffect (rule 2)
  try {
    const startDate = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1
    )
      .toISOString()
      .split('T')[0];
    const endDate = new Date().toISOString().split('T')[0];

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/admin/reports?start=${startDate}&end=${endDate}`,
      { cache: 'no-store' }
    );

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return null;
    }

    const data = await response.json();

    if (data.success) {
      return data.data;
    }
    return null;
  } catch (error) {
    console.error('Failed to load reports:', error);
    return null;
  }
}

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <p className="text-gray-600">Loading financial reports...</p>
      </div>
    </div>
  );
}

export default async function ReportsPage() {
  // Server Component: no useState, no useEffect, no client libraries needed
  const initialReports = await getInitialReports();

  return (
    <Suspense fallback={<LoadingFallback />}>
      <AdminReportsContent initialReports={initialReports} />
    </Suspense>
  );
}
