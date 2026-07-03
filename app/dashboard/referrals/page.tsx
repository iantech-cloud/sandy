import { Suspense } from 'react';
import { DashboardReferralsContent } from '../DashboardReferralsContent';
import { Loader2 } from 'lucide-react';
import {
  getReferralCommissionStats,
  getReferralInfo,
} from '@/app/actions/referrals';

interface Referral {
  id: string;
  name: string;
  email: string;
  joinDate: string;
  status: string;
  activationStatus: string;
  earnings: number;
  level: number;
  rank: string;
  tasksCompleted: number;
  referralCount: number;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

interface Summary {
  total: number;
  active: number;
  activated: number;
  totalEarnings: number;
}

interface CommissionStats {
  level1: { totalEarnings: number; count: number };
  level2: { totalEarnings: number; count: number };
  total: number;
}

async function getInitialData() {
  // Server-side fetch: no useState, no useEffect (rule 2)
  try {
    const [statsRes, infoRes, referralsRes] = await Promise.all([
      getReferralCommissionStats(),
      getReferralInfo(),
      fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/referrals?page=1&limit=20`, {
        cache: 'no-store',
      }),
    ]);

    let commStats: CommissionStats | null = null;
    if (statsRes.success && statsRes.data) {
      commStats = statsRes.data;
    }

    let referralCode = '';
    if (infoRes.success && infoRes.data) {
      referralCode = infoRes.data.referralCode;
    }

    let referrals: Referral[] = [];
    let pagination: Pagination | null = null;
    let summary: Summary | null = null;

    if (referralsRes.ok) {
      const referralsData = await referralsRes.json();
      if (referralsData.success) {
        referrals = referralsData.data || [];
        pagination = referralsData.pagination || null;
        summary = referralsData.summary || null;
      }
    }

    return {
      referrals,
      pagination,
      summary,
      commStats,
      referralCode,
    };
  } catch (error) {
    console.error('Failed to load referral data:', error);
    return {
      referrals: [],
      pagination: null,
      summary: null,
      commStats: null,
      referralCode: '',
    };
  }
}

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <p className="text-gray-600">Loading referral data...</p>
      </div>
    </div>
  );
}

export default async function ReferralsPage() {
  // Server Component: no useState, no useEffect, no client libraries needed
  const {
    referrals,
    pagination,
    summary,
    commStats,
    referralCode,
  } = await getInitialData();

  return (
    <Suspense fallback={<LoadingFallback />}>
      <DashboardReferralsContent
        initialReferrals={referrals}
        initialPagination={pagination}
        initialSummary={summary}
        initialCommStats={commStats}
        initialReferralCode={referralCode}
      />
    </Suspense>
  );
}
