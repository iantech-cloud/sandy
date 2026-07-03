'use client';

import { useState, useCallback, useEffect } from 'react';
import { Users, TrendingUp, CheckCircle, Clock, Loader2, RefreshCw, Copy, Check } from 'lucide-react';
import { format } from 'date-fns';
import { maskEmail } from '@/app/lib/email-utils';
import { getReferralCommissionStats, getReferralInfo } from '@/app/actions/referrals';
import { useQuery } from '@tanstack/react-query';

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

interface DashboardReferralsContentProps {
  initialReferrals: Referral[];
  initialPagination: Pagination | null;
  initialSummary: Summary | null;
  initialCommStats: CommissionStats | null;
  initialReferralCode: string;
}

function safeDate(d: string | null | undefined): string {
  if (!d) return '—';
  try {
    return format(new Date(d), 'MMM dd, yyyy');
  } catch {
    return '—';
  }
}

function statusColor(status: string) {
  switch (status) {
    case 'active':
      return 'bg-green-900/30 text-green-300';
    case 'pending':
      return 'bg-yellow-900/30 text-yellow-300';
    case 'suspended':
      return 'bg-orange-900/30 text-orange-300';
    case 'banned':
      return 'bg-red-900/30 text-red-300';
    default:
      return 'bg-slate-700 text-slate-400';
  }
}

export function DashboardReferralsContent({
  initialReferrals,
  initialPagination,
  initialSummary,
  initialCommStats,
  initialReferralCode,
}: DashboardReferralsContentProps) {
  const LIMIT = 20;

  // Ephemeral UI state only (rule 6)
  const [currentPage, setCurrentPage] = useState(1);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [referralLink, setReferralLink] = useState('');

  // React Query: Replace useState(referrals) + useEffect (rule 2)
  const { data: referralsData = { referrals: initialReferrals, pagination: initialPagination, summary: initialSummary }, isLoading: referralsLoading } = useQuery({
    queryKey: ['referrals', currentPage],
    queryFn: async () => {
      const res = await fetch(`/api/referrals?page=${currentPage}&limit=${LIMIT}`);
      const json = await res.json();
      if (json.success) {
        return {
          referrals: json.data,
          pagination: json.pagination,
          summary: json.summary,
        };
      }
      return { referrals: [], pagination: null, summary: null };
    },
    initialData: { referrals: initialReferrals, pagination: initialPagination, summary: initialSummary },
  });

  // React Query: Replace useState(commStats) + useEffect (rule 2)
  const { data: commStats = initialCommStats, isLoading: statsLoading } = useQuery({
    queryKey: ['referral-commission-stats'],
    queryFn: async () => {
      const statsRes = await getReferralCommissionStats();
      if (statsRes.success && statsRes.data) {
        return statsRes.data;
      }
      return initialCommStats;
    },
    initialData: initialCommStats,
  });

  // Set referral link on mount (client-only, rule 6)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const origin = window.location.origin;
      setReferralLink(`${origin}/auth/sign-up?ref=${initialReferralCode}`);
    }
  }, [initialReferralCode]);

  // Clipboard helpers (ephemeral UI state, rule 6)
  const copyCode = () => {
    navigator.clipboard.writeText(initialReferralCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const { referrals, pagination, summary } = referralsData;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-slate-900 mb-2">Your Referral Network</h1>
        <p className="text-slate-500">Grow your earnings by referring friends and expanding your network</p>
      </div>

      {/* Referral Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-600 text-sm font-medium">Total Referrals</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{summary?.total || 0}</p>
          <p className="text-xs text-slate-500 mt-1">All-time</p>
        </div>

        <div className="bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-600 text-sm font-medium">Active Referrals</span>
            <CheckCircle className="w-4 h-4 text-green-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{summary?.active || 0}</p>
          <p className="text-xs text-slate-500 mt-1">Currently active</p>
        </div>

        <div className="bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-600 text-sm font-medium">Activated Referrals</span>
            <CheckCircle className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{summary?.activated || 0}</p>
          <p className="text-xs text-slate-500 mt-1">Completed signup</p>
        </div>

        <div className="bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-600 text-sm font-medium">Total Earnings</span>
            <TrendingUp className="w-4 h-4 text-green-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900">KES {(summary?.totalEarnings || 0).toLocaleString()}</p>
          <p className="text-xs text-slate-500 mt-1">All earnings</p>
        </div>
      </div>

      {/* Commission Stats */}
      {commStats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200 rounded-lg p-6">
            <h3 className="text-sm font-semibold text-slate-600 mb-3">Level 1 Commission</h3>
            <div className="space-y-2">
              <p className="text-2xl font-bold text-slate-900">KES {commStats.level1.totalEarnings.toLocaleString()}</p>
              <p className="text-xs text-slate-500">{commStats.level1.count} referrals</p>
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-6">
            <h3 className="text-sm font-semibold text-slate-600 mb-3">Level 2 Commission</h3>
            <div className="space-y-2">
              <p className="text-2xl font-bold text-slate-900">KES {commStats.level2.totalEarnings.toLocaleString()}</p>
              <p className="text-xs text-slate-500">{commStats.level2.count} referrals</p>
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-6">
            <h3 className="text-sm font-semibold text-slate-600 mb-3">Total Commission</h3>
            <div className="space-y-2">
              <p className="text-2xl font-bold text-slate-900">KES {commStats.total.toLocaleString()}</p>
              <p className="text-xs text-slate-500">All levels</p>
            </div>
          </div>
        </div>
      )}

      {/* Referral Link Section */}
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Your Referral Links</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-2">Referral Code</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={initialReferralCode}
                readOnly
                className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded text-slate-900"
              />
              <button
                onClick={copyCode}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center gap-2"
              >
                {copiedCode ? (
                  <>
                    <Check className="w-4 h-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy
                  </>
                )}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-2">Referral Link</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={referralLink}
                readOnly
                className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded text-slate-900 text-sm"
              />
              <button
                onClick={copyLink}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center gap-2"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-4 h-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Referrals Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Your Referrals</h2>
        </div>

        {referralsLoading ? (
          <div className="p-8 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500" />
          </div>
        ) : referrals.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No referrals yet. Start by sharing your link!</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-900">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-900">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-900">Joined</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-900">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-900">Earnings</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {referrals.map((ref: Referral) => (
                  <tr key={ref.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 text-sm text-slate-900">{ref.name || '—'}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{maskEmail(ref.email) || '—'}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{safeDate(ref.joinDate)}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColor(ref.status)}`}>
                        {ref.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                      KES {ref.earnings.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.pages > 1 && (
          <div className="px-6 py-4 border-t border-slate-200 flex justify-center gap-2">
            {Array.from({ length: pagination.pages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`px-3 py-2 rounded text-sm font-medium ${
                  currentPage === page
                    ? 'bg-blue-500 text-white'
                    : 'bg-slate-100 text-slate-900 hover:bg-slate-200'
                }`}
              >
                {page}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
