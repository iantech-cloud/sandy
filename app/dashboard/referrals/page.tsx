'use client';

import { useState, useEffect, useCallback } from 'react';
import { Users, TrendingUp, CheckCircle, Clock, Loader2, RefreshCw, Copy, Check } from 'lucide-react';
import { format } from 'date-fns';
import { maskEmail } from '@/app/lib/email-utils';
import { getReferralCommissionStats, getReferralInfo } from '@/app/actions/referrals';

// ─── Types ────────────────────────────────────────────────────────────────────

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

interface ApiResponse {
  success: boolean;
  data: Referral[];
  pagination: Pagination;
  summary: Summary;
}

interface CommissionStats {
  level1: { totalEarnings: number; count: number };
  level2: { totalEarnings: number; count: number };
  total: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safeDate(d: string | null | undefined): string {
  if (!d) return '—';
  try { return format(new Date(d), 'MMM dd, yyyy'); } catch { return '—'; }
}

function statusColor(status: string) {
  switch (status) {
    case 'active':    return 'bg-green-900/30 text-green-300';
    case 'pending':   return 'bg-yellow-900/30 text-yellow-300';
    case 'suspended': return 'bg-orange-900/30 text-orange-300';
    case 'banned':    return 'bg-red-900/30 text-red-300';
    default:          return 'bg-slate-700 text-slate-400';
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReferralsPage() {
  const [referrals, setReferrals]           = useState<Referral[]>([]);
  const [pagination, setPagination]         = useState<Pagination | null>(null);
  const [summary, setSummary]               = useState<Summary | null>(null);
  const [commStats, setCommStats]           = useState<CommissionStats | null>(null);
  const [referralLink, setReferralLink]     = useState('');
  const [referralCode, setReferralCode]     = useState('');

  const [loading, setLoading]               = useState(true);
  const [statsLoading, setStatsLoading]     = useState(true);
  const [currentPage, setCurrentPage]       = useState(1);

  const [copiedCode, setCopiedCode]         = useState(false);
  const [copiedLink, setCopiedLink]         = useState(false);

  const LIMIT = 20;

  // ── Fetch paginated referrals ─────────────────────────────────────────────
  const fetchReferrals = useCallback(async (page: number) => {
    setLoading(true);
    try {
      const res  = await fetch(`/api/referrals?page=${page}&limit=${LIMIT}`);
      const json: ApiResponse = await res.json();
      if (json.success) {
        setReferrals(json.data);
        setPagination(json.pagination);
        setSummary(json.summary);
      } else {
        setReferrals([]);
      }
    } catch (err) {
      console.error('[referrals] fetch error', err);
      setReferrals([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Fetch commission stats + referral link once ───────────────────────────
  useEffect(() => {
    (async () => {
      setStatsLoading(true);
      try {
        const [statsRes, infoRes] = await Promise.all([
          getReferralCommissionStats(),
          getReferralInfo(),
        ]);
        if (statsRes.success && statsRes.data) setCommStats(statsRes.data);
        if (infoRes.success && infoRes.data) {
          const code   = infoRes.data.referralCode;
          const origin = typeof window !== 'undefined' ? window.location.origin : '';
          setReferralCode(code);
          setReferralLink(`${origin}/auth/sign-up?ref=${code}`);
        }
      } catch (err) {
        console.error('[referrals] stats/info error', err);
      } finally {
        setStatsLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    fetchReferrals(currentPage);
  }, [fetchReferrals, currentPage]);

  // ── Clipboard helpers ─────────────────────────────────────────────────────
  const copyCode = () => {
    navigator.clipboard.writeText(referralCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };
  const copyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-1">Referral Network</h1>
            <p className="text-slate-400 text-sm">Grow your network and earn commissions on every activation</p>
          </div>
          <button
            onClick={() => fetchReferrals(currentPage)}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gradient-to-br from-blue-900/30 to-cyan-900/30 border border-blue-500/30 rounded-lg p-5">
            <p className="text-slate-400 text-xs mb-1 uppercase tracking-wide">Total Referred</p>
            <p className="text-2xl font-bold text-blue-400">{summary?.total ?? '—'}</p>
            <Users className="w-5 h-5 text-blue-500 mt-2" />
          </div>
          <div className="bg-gradient-to-br from-green-900/30 to-emerald-900/30 border border-green-500/30 rounded-lg p-5">
            <p className="text-slate-400 text-xs mb-1 uppercase tracking-wide">Active</p>
            <p className="text-2xl font-bold text-green-400">{summary?.active ?? '—'}</p>
            <CheckCircle className="w-5 h-5 text-green-500 mt-2" />
          </div>
          <div className="bg-gradient-to-br from-amber-900/30 to-orange-900/30 border border-amber-500/30 rounded-lg p-5">
            <p className="text-slate-400 text-xs mb-1 uppercase tracking-wide">Activated</p>
            <p className="text-2xl font-bold text-amber-400">{summary?.activated ?? '—'}</p>
            <Clock className="w-5 h-5 text-amber-500 mt-2" />
          </div>
          <div className="bg-gradient-to-br from-purple-900/30 to-violet-900/30 border border-purple-500/30 rounded-lg p-5">
            <p className="text-slate-400 text-xs mb-1 uppercase tracking-wide">Total Earned</p>
            <p className="text-2xl font-bold text-purple-400">
              KES {(summary?.totalEarnings ?? 0).toLocaleString('en-KE', { minimumFractionDigits: 0 })}
            </p>
            <TrendingUp className="w-5 h-5 text-purple-500 mt-2" />
          </div>
        </div>

        {/* Referral Code + Link */}
        <div className="bg-slate-800/50 border border-slate-700/30 rounded-lg p-5 mb-6">
          <h2 className="text-white font-semibold mb-4">Your Referral Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Code */}
            <div>
              <label className="text-slate-400 text-xs font-medium mb-2 block uppercase tracking-wide">Referral Code</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-4 py-2.5 bg-slate-900 border border-slate-600 rounded-lg text-indigo-300 font-mono text-sm truncate">
                  {referralCode || 'Loading...'}
                </code>
                <button
                  onClick={copyCode}
                  disabled={!referralCode}
                  className="flex items-center gap-1.5 px-3 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm transition-colors disabled:opacity-40"
                >
                  {copiedCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copiedCode ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
            {/* Link */}
            <div>
              <label className="text-slate-400 text-xs font-medium mb-2 block uppercase tracking-wide">Referral Link</label>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={referralLink || 'Loading...'}
                  className="flex-1 px-4 py-2.5 bg-slate-900 border border-slate-600 rounded-lg text-slate-300 font-mono text-xs truncate focus:outline-none"
                />
                <button
                  onClick={copyLink}
                  disabled={!referralLink}
                  className="flex items-center gap-1.5 px-3 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors disabled:opacity-40"
                >
                  {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copiedLink ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
          </div>

        </div>

        {/* Commission Breakdown */}
        <div className="bg-slate-800/50 border border-slate-700/30 rounded-lg p-5 mb-6">
          <h2 className="text-white font-semibold mb-4">Commission Breakdown</h2>
          {statsLoading ? (
            <div className="flex items-center gap-3 text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Loading commission data&hellip;</span>
            </div>
          ) : commStats ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-slate-900/50 border border-green-500/20 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-green-400">
                  KES {commStats.level1.totalEarnings.toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-slate-400 text-sm mt-1">Level 1 Earnings</p>
                <p className="text-green-600 text-xs mt-0.5">{commStats.level1.count} commission{commStats.level1.count !== 1 ? 's' : ''}</p>
              </div>
              <div className="bg-slate-900/50 border border-amber-500/20 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-amber-400">
                  KES {(commStats.level2?.totalEarnings ?? 0).toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-slate-400 text-sm mt-1">Level 2 Earnings</p>
                <p className="text-amber-600 text-xs mt-0.5">{commStats.level2?.count ?? 0} commission{(commStats.level2?.count ?? 0) !== 1 ? 's' : ''}</p>
              </div>
              <div className="bg-slate-900/50 border border-blue-500/20 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-blue-400">
                  KES {commStats.total.toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-slate-400 text-sm mt-1">Total Referral Earnings</p>
                <p className="text-blue-600 text-xs mt-0.5">All tiers combined</p>
              </div>
            </div>
          ) : (
            <p className="text-slate-500 text-sm">Commission data not available.</p>
          )}
        </div>

        {/* Referrals Table */}
        <div className="bg-slate-800/50 border border-slate-700/30 rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between">
            <h2 className="text-white font-semibold">
              Your Referral Network
              {pagination && (
                <span className="text-slate-500 text-sm font-normal ml-2">({pagination.total} total)</span>
              )}
            </h2>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center h-56 gap-3">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
              <p className="text-slate-400 text-sm">Loading referrals&hellip;</p>
            </div>
          ) : referrals.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-56 gap-2">
              <Users className="w-12 h-12 text-slate-600" />
              <p className="text-slate-300 font-medium">No referrals yet</p>
              <p className="text-slate-500 text-sm">Share your referral link to grow your network.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-700 bg-slate-900/50">
                      <th className="px-5 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">User</th>
                      <th className="px-5 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Joined</th>
                      <th className="px-5 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                      <th className="px-5 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Activated</th>
                      <th className="px-5 py-4 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Your Earning</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {referrals.map(ref => (
                      <tr key={ref.id} className="hover:bg-slate-700/30 transition-colors">
                        <td className="px-5 py-4">
                          <p className="text-slate-200 text-sm font-medium">
                            {ref.name || <span className="text-slate-500 italic">No username</span>}
                          </p>
                          {ref.email && (
                            <p className="text-slate-500 text-xs mt-0.5">{maskEmail(ref.email, 2)}</p>
                          )}
                        </td>
                        <td className="px-5 py-4 text-sm text-slate-400 whitespace-nowrap">
                          {safeDate(ref.joinDate)}
                        </td>
                        <td className="px-5 py-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColor(ref.status)}`}>
                            {ref.status ? ref.status.charAt(0).toUpperCase() + ref.status.slice(1) : 'Unknown'}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                            ref.activationStatus === 'activated'
                              ? 'bg-blue-900/30 text-blue-300'
                              : 'bg-slate-700 text-slate-500'
                          }`}>
                            {ref.activationStatus === 'activated' ? 'Yes' : 'No'}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-sm font-semibold text-right">
                          <span className="text-green-400">
                            KES {(ref.earnings || 0).toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pagination && pagination.pages > 1 && (
                <div className="px-5 py-4 border-t border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <p className="text-sm text-slate-400">
                    Showing {((pagination.page - 1) * pagination.limit) + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} referrals
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1 || loading}
                      className="px-4 py-2 rounded-lg bg-slate-700 text-slate-300 text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-600 transition-colors"
                    >
                      Previous
                    </button>
                    {/* Page number pills — show up to 5 around current */}
                    {Array.from({ length: pagination.pages }, (_, i) => i + 1)
                      .filter(p => Math.abs(p - currentPage) <= 2 || p === 1 || p === pagination.pages)
                      .reduce<(number | 'ellipsis')[]>((acc, p, idx, arr) => {
                        if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('ellipsis');
                        acc.push(p);
                        return acc;
                      }, [])
                      .map((item, idx) =>
                        item === 'ellipsis' ? (
                          <span key={`e-${idx}`} className="text-slate-600 px-1">…</span>
                        ) : (
                          <button
                            key={item}
                            onClick={() => setCurrentPage(item as number)}
                            disabled={loading}
                            className={`w-9 h-9 rounded-lg text-sm transition-colors disabled:opacity-40 ${
                              currentPage === item
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            }`}
                          >
                            {item}
                          </button>
                        )
                      )}
                    <button
                      onClick={() => setCurrentPage(p => Math.min(pagination.pages, p + 1))}
                      disabled={currentPage === pagination.pages || loading}
                      className="px-4 py-2 rounded-lg bg-slate-700 text-slate-300 text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-600 transition-colors"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
