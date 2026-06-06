'use client';

import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Users, TrendingUp, MessageSquare, CheckCircle2, Search, ChevronDown, ChevronUp } from 'lucide-react';

interface UserRow {
  id: string;
  username: string;
  email: string;
  isActive: boolean;
  createdAt: string;
  referrerId: string | null;
  referrerUsername: string | null;
  directDownlines: number;
  cfBotsUnlocked: number;
  cfMessages: number;
  cfMilestonesReached: number;
  cfEarnings: number;
  cfUnlocksBrought: number;
}

interface DownlineData {
  totalUsers: number;
  totalReferredUsers: number;
  totalCFEarnings: number;
  topReferrers: UserRow[];
  recentlyReferred: UserRow[];
  allUsers: UserRow[];
}

type TabType = 'top-referrers' | 'recently-referred' | 'all-users';

export default function CFUsersAdminPage() {
  const [data, setData] = useState<DownlineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('top-referrers');
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<keyof UserRow>('cfEarnings');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    fetch('/api/chat-foreigners/admin/downline')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setData(d.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSort = (field: keyof UserRow) => {
    if (sortField === field) {
      setSortDir((p) => (p === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const sortedUsers = (list: UserRow[]) => {
    const filtered = list.filter(
      (u) =>
        u.username.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase()) ||
        (u.referrerUsername || '').toLowerCase().includes(search.toLowerCase())
    );
    return [...filtered].sort((a, b) => {
      const av = a[sortField];
      const bv = b[sortField];
      const mul = sortDir === 'asc' ? 1 : -1;
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * mul;
      return String(av).localeCompare(String(bv)) * mul;
    });
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-600">Loading downline data...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return <div className="p-8 text-center text-gray-600">Failed to load data.</div>;
  }

  const getTabData = (): UserRow[] => {
    if (activeTab === 'top-referrers') return sortedUsers(data.topReferrers);
    if (activeTab === 'recently-referred') return sortedUsers(data.recentlyReferred);
    return sortedUsers(data.allUsers);
  };

  const SortIcon = ({ field }: { field: keyof UserRow }) => {
    if (sortField !== field) return null;
    return sortDir === 'asc' ? (
      <ChevronUp className="w-3.5 h-3.5 inline ml-1" />
    ) : (
      <ChevronDown className="w-3.5 h-3.5 inline ml-1" />
    );
  };

  const Th = ({ label, field }: { label: string; field: keyof UserRow }) => (
    <th
      className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:text-gray-900 select-none whitespace-nowrap"
      onClick={() => handleSort(field)}
    >
      {label}
      <SortIcon field={field} />
    </th>
  );

  const tableData = getTabData();

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Referral Downline Map</h1>
        <p className="text-gray-600 mt-1">
          Chat Foreigners referral structure — who invited whom and their earnings
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Users"
          value={data.totalUsers}
          icon={<Users className="w-5 h-5 text-blue-600" />}
          bg="bg-blue-50"
        />
        <StatCard
          label="Referred Users"
          value={data.totalReferredUsers}
          icon={<TrendingUp className="w-5 h-5 text-green-600" />}
          bg="bg-green-50"
        />
        <StatCard
          label="CF Earnings Paid"
          value={`KES ${(data.totalCFEarnings / 100).toLocaleString()}`}
          icon={<CheckCircle2 className="w-5 h-5 text-purple-600" />}
          bg="bg-purple-50"
        />
        <StatCard
          label="Top Referrers"
          value={data.topReferrers.length}
          icon={<MessageSquare className="w-5 h-5 text-orange-600" />}
          bg="bg-orange-50"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {(
          [
            { key: 'top-referrers', label: 'Top Referrers' },
            { key: 'recently-referred', label: 'Recently Referred' },
            { key: 'all-users', label: 'All Users' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by username, email, or referrer..."
          className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <Th label="User" field="username" />
                <Th label="Referred By" field="referrerUsername" />
                <Th label="Downlines" field="directDownlines" />
                <Th label="Bots Unlocked" field="cfBotsUnlocked" />
                <Th label="Messages" field="cfMessages" />
                <Th label="Milestones" field="cfMilestonesReached" />
                <Th label="CF Earnings" field="cfEarnings" />
                <Th label="Unlocks Brought" field="cfUnlocksBrought" />
                <Th label="Joined" field="createdAt" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tableData.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-gray-500">
                    No records found.
                  </td>
                </tr>
              ) : (
                tableData.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-sm text-gray-900">{user.username}</p>
                        <p className="text-xs text-gray-500">{user.email}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {user.referrerUsername ? (
                        <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 rounded-full px-2.5 py-0.5 text-xs font-medium">
                          {user.referrerUsername}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">Direct</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-sm font-bold ${user.directDownlines > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                        {user.directDownlines}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-sm font-bold ${user.cfBotsUnlocked > 0 ? 'text-purple-600' : 'text-gray-400'}`}>
                        {user.cfBotsUnlocked}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-sm font-bold ${user.cfMessages > 0 ? 'text-indigo-600' : 'text-gray-400'}`}>
                        {user.cfMessages}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {user.cfMilestonesReached > 0 ? (
                        <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 rounded-full px-2.5 py-0.5 text-xs font-medium">
                          <CheckCircle2 className="w-3 h-3" />
                          {user.cfMilestonesReached}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {user.cfEarnings > 0 ? (
                        <span className="text-sm font-bold text-green-600">
                          KES {(user.cfEarnings / 100).toFixed(0)}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-sm font-bold ${user.cfUnlocksBrought > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
                        {user.cfUnlocksBrought}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {user.createdAt
                        ? formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })
                        : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-500">
          Showing {tableData.length} of{' '}
          {activeTab === 'all-users'
            ? data.allUsers.length
            : activeTab === 'top-referrers'
            ? data.topReferrers.length
            : data.recentlyReferred.length}{' '}
          records
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  bg,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  bg: string;
}) {
  return (
    <div className={`${bg} rounded-xl p-4 border border-white shadow-sm`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-gray-700">{label}</p>
        {icon}
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}
