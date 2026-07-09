'use client';

import { useState, useEffect } from 'react';
import { Users, MessageSquare, DollarSign, TrendingUp, Award, Network, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

interface Analytics {
  totalPersons: number;
  totalPersonUnlocks: number;
  totalMessages: number;
  totalRevenue: number;
  totalMilestones: number;
  totalCFEarningsPaid: number;
  totalChatEarningsCredited: number;
  topPersons: Array<{ name: string; unlocks: number; revenue: number }>;
}

export default function AnalyticsDashboard() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      const [personsRes, downlineRes] = await Promise.all([
        fetch('/api/chat-foreigners/bots?includeAccess=true'),
        fetch('/api/chat-foreigners/admin/downline'),
      ]);

      const [personsData, downlineData] = await Promise.all([
        personsRes.json(),
        downlineRes.json(),
      ]);

      const persons = personsData.success ? (personsData.data || []) : [];

      const totalPersonUnlocks = persons.reduce(
        (sum: number, p: any) => sum + (p.userAccess || []).length,
        0
      );
      const totalMessages = persons.reduce(
        (sum: number, p: any) =>
          sum +
          (p.userAccess || []).reduce((s: number, a: any) => s + (a.messageCount || 0), 0),
        0
      );
      const totalMilestones = persons.reduce(
        (sum: number, p: any) =>
          sum + (p.userAccess || []).filter((a: any) => a.firstMilestoneComplete).length,
        0
      );
      const totalRevenue = persons.reduce(
        (sum: number, p: any) => sum + (p.userAccess || []).length * (p.unlockPrice || 60),
        0
      );
      const topPersons = persons
        .map((p: any) => ({
          name: p.name,
          unlocks: (p.userAccess || []).length,
          revenue: (p.userAccess || []).length * (p.unlockPrice || 60),
        }))
        .sort((a: any, b: any) => b.unlocks - a.unlocks)
        .slice(0, 5);

      const totalCFEarningsPaid = downlineData.success
        ? (downlineData.data?.totalCFEarnings || 0) / 100
        : 0;

      // Calculate total chat earnings credited across all users
      const totalChatEarningsCredited = persons.reduce(
        (sum: number, p: any) =>
          sum +
          (p.userAccess || []).reduce(
            (s: number, a: any) => s + ((a.chat_earnings_cents || 0) / 100),
            0
          ),
        0
      );

      setAnalytics({
        totalPersons: persons.length,
        totalPersonUnlocks,
        totalMessages,
        totalRevenue,
        totalMilestones,
        totalCFEarningsPaid,
        totalChatEarningsCredited,
        topPersons,
      });
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return <div className="p-8 text-center text-gray-600">Failed to load analytics data.</div>;
  }

  const metrics = [
    {
      label: 'Personalities',
      value: analytics.totalPersons,
      icon: <Users className="w-6 h-6 text-blue-600" />,
      bg: 'bg-blue-50',
      sub: 'Active profiles',
    },
    {
      label: 'Unlocks',
      value: analytics.totalPersonUnlocks,
      icon: <TrendingUp className="w-6 h-6 text-green-600" />,
      bg: 'bg-green-50',
      sub: 'Paid connections',
    },
    {
      label: 'Messages',
      value: analytics.totalMessages.toLocaleString(),
      icon: <MessageSquare className="w-6 h-6 text-purple-600" />,
      bg: 'bg-purple-50',
      sub: 'Total exchanged',
    },
    {
      label: 'Revenue',
      value: `KES ${analytics.totalRevenue.toLocaleString()}`,
      icon: <DollarSign className="w-6 h-6 text-orange-600" />,
      bg: 'bg-orange-50',
      sub: 'From unlocks',
    },
    {
      label: 'Milestones',
      value: analytics.totalMilestones,
      icon: <Award className="w-6 h-6 text-indigo-600" />,
      bg: 'bg-indigo-50',
      sub: '20-message targets hit',
    },
    {
      label: 'Referral Payouts',
      value: `KES ${analytics.totalCFEarningsPaid.toLocaleString()}`,
      icon: <Network className="w-6 h-6 text-teal-600" />,
      bg: 'bg-teal-50',
      sub: 'Paid to referrers',
    },
    {
      label: 'Chat Earnings Credited',
      value: `KES ${analytics.totalChatEarningsCredited.toLocaleString()}`,
      icon: <TrendingUp className="w-6 h-6 text-lime-600" />,
      bg: 'bg-lime-50',
      sub: 'From message interactions',
    },
  ];

  return (
    <div className="p-6 space-y-8">
      {/* API Limit Error Banner */}
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-4">
        <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
        <div>
          <h3 className="font-semibold text-red-900">API Limit Hit</h3>
          <p className="text-red-700 text-sm mt-1">API limit hit from this IP, kindly upgrade to continue.</p>
        </div>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
        <p className="text-gray-600 mt-1">Chat Foreigners platform metrics and referral insights</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {metrics.map((m) => (
          <div key={m.label} className={`${m.bg} rounded-xl p-5 border border-white shadow-sm`}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-gray-700">{m.label}</p>
              {m.icon}
            </div>
            <p className="text-2xl font-bold text-gray-900">{m.value}</p>
            <p className="text-xs text-gray-500 mt-1">{m.sub}</p>
          </div>
        ))}
      </div>

      {/* Top Performers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-gray-100">
            <h2 className="font-bold text-gray-900">Top Performing Personalities</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {analytics.topPersons.length === 0 ? (
              <p className="px-5 py-6 text-gray-500 text-sm">No data yet.</p>
            ) : (
              analytics.topPersons.map((person, idx) => (
                <div key={idx} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                      {idx + 1}
                    </span>
                    <div>
                      <p className="font-medium text-sm text-gray-900">{person.name}</p>
                      <p className="text-xs text-gray-500">{person.unlocks} unlocks</p>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-gray-900">
                    KES {person.revenue.toLocaleString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-gray-100">
            <h2 className="font-bold text-gray-900">Quick Actions</h2>
          </div>
          <div className="p-5 space-y-3">
            {[
              { href: '/admin/chat-foreigners/bots', label: 'Manage Personalities', desc: 'Add, edit, clone personas' },
              { href: '/admin/chat-foreigners/users', label: 'Downline Map', desc: 'Referral tree and earnings' },
              { href: '/admin/chat-foreigners', label: 'CF Admin Home', desc: 'Overview page' },
            ].map((a) => (
              <Link
                key={a.href}
                href={a.href}
                className="flex items-center justify-between p-3 bg-gray-50 hover:bg-blue-50 rounded-lg transition-colors group"
              >
                <div>
                  <p className="font-medium text-sm text-gray-900 group-hover:text-blue-700">
                    {a.label}
                  </p>
                  <p className="text-xs text-gray-500">{a.desc}</p>
                </div>
                <TrendingUp className="w-4 h-4 text-gray-400 group-hover:text-blue-500" />
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Engagement summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="font-bold text-gray-900 mb-4">Engagement Metrics</h3>
          <div className="space-y-3">
            <MetricRow
              label="Avg. Messages per Unlock"
              value={
                analytics.totalPersonUnlocks > 0
                  ? (analytics.totalMessages / analytics.totalPersonUnlocks).toFixed(1)
                  : '0'
              }
            />
            <MetricRow
              label="Milestone Completion Rate"
              value={
                analytics.totalPersonUnlocks > 0
                  ? `${((analytics.totalMilestones / analytics.totalPersonUnlocks) * 100).toFixed(0)}%`
                  : '0%'
              }
            />
            <MetricRow
              label="Referral Payout Rate"
              value={
                analytics.totalRevenue > 0
                  ? `${((analytics.totalCFEarningsPaid / analytics.totalRevenue) * 100).toFixed(0)}%`
                  : '0%'
              }
            />
            <div className="flex justify-between pt-3 border-t">
              <span className="text-sm font-semibold text-gray-700">Platform Health</span>
              <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                Good
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="font-bold text-gray-900 mb-4">Revenue Split</h3>
          <div className="space-y-3">
            <MetricRow label="Total Unlocks Revenue" value={`KES ${analytics.totalRevenue.toLocaleString()}`} />
            <MetricRow
              label="Referral Commissions Paid"
              value={`KES ${analytics.totalCFEarningsPaid.toLocaleString()}`}
              highlight="text-orange-600"
            />
            <MetricRow
              label="Net Platform Revenue"
              value={`KES ${(analytics.totalRevenue - analytics.totalCFEarningsPaid).toLocaleString()}`}
              highlight="text-green-600"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | number;
  highlight?: string;
}) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-gray-600">{label}</span>
      <span className={`text-sm font-semibold ${highlight ?? 'text-gray-900'}`}>{value}</span>
    </div>
  );
}
