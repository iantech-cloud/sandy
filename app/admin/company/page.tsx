import { Suspense } from 'react';
import { AdminCompanyContent } from '../AdminCompanyContent';
import { Loader2 } from 'lucide-react';
import {
  getCompanyProfile,
  getCompanyTransactions,
  getRevenueBreakdown,
} from '@/app/actions/company';

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

async function getInitialData() {
  // Server-side fetch: no useState, no useEffect (rule 2)
  try {
    const [profileRes, transactionsRes, revenueRes] = await Promise.all([
      getCompanyProfile(),
      getCompanyTransactions(),
      getRevenueBreakdown(),
    ]);

    const company: CompanyData | null = profileRes.success ? profileRes.data : null;
    const transactions: Transaction[] = transactionsRes.success ? transactionsRes.data || [] : [];
    const revenueBreakdown = revenueRes.success ? revenueRes.data : null;

    const stats: CompanyStats = {
      total_revenue: company?.total_revenue || 0,
      total_expenses: company?.total_expenses || 0,
      net_profit: (company?.total_revenue || 0) - (company?.total_expenses || 0),
      current_balance: company?.wallet_balance || 0,
      transactions_count: transactions.length,
      activation_count: 0,
      referral_bonus_count: 0,
      today_revenue: 0,
      this_week_revenue: 0,
      this_month_revenue: 0,
    };

    return {
      company,
      stats,
      transactions,
      revenueBreakdown,
    };
  } catch (error) {
    console.error('Failed to load company data:', error);
    return {
      company: null,
      stats: null,
      transactions: [],
      revenueBreakdown: null,
    };
  }
}

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <p className="text-gray-600">Loading company data...</p>
      </div>
    </div>
  );
}

export default async function CompanyDashboardPage() {
  // Server Component: no useState, no useEffect, no client libraries needed
  const { company, stats, transactions, revenueBreakdown } = await getInitialData();

  return (
    <Suspense fallback={<LoadingFallback />}>
      <AdminCompanyContent
        initialCompany={company}
        initialStats={stats}
        initialTransactions={transactions}
        initialRevenueBreakdown={revenueBreakdown}
      />
    </Suspense>
  );
}
