'use client';

import { useState, useEffect } from 'react';
import { Users, TrendingUp, CreditCard, CheckCircle, ArrowUp, AlertCircle } from 'lucide-react';

interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  pendingActivations: number;
  totalApproved: number;
  conversionRate: string | number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/admin/stats/dashboard');
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard stats');
      }

      const data = await response.json();
      if (data.success) {
        setStats(data.stats);
      } else {
        setError('Failed to load statistics');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('[Admin] Dashboard error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto" />
          <p className="mt-4 text-slate-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <AlertCircle size={20} className="text-red-600" />
          <p className="text-red-700">{error}</p>
        </div>
        <button
          onClick={loadStats}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!stats) return null;

  const StatCard = ({
    icon: Icon,
    title,
    value,
    subtitle,
    color,
  }: {
    icon: typeof Users;
    title: string;
    value: string | number;
    subtitle?: string;
    color: 'blue' | 'green' | 'yellow' | 'purple';
  }) => {
    const colorClasses = {
      blue: 'bg-blue-50 text-blue-700',
      green: 'bg-green-50 text-green-700',
      yellow: 'bg-yellow-50 text-yellow-700',
      purple: 'bg-purple-50 text-purple-700',
    };

    return (
      <div className="bg-white rounded-lg shadow p-6 border border-slate-200">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-slate-600 text-sm font-medium">{title}</p>
            <p className="text-3xl font-bold text-slate-900 mt-2">{value}</p>
            {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
          </div>
          <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
            <Icon size={24} />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-600 mt-1">Platform overview and key metrics</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          icon={Users}
          title="Total Users"
          value={stats.totalUsers.toLocaleString()}
          color="blue"
        />

        <StatCard
          icon={TrendingUp}
          title="Active Users"
          value={stats.activeUsers.toLocaleString()}
          subtitle={`${stats.conversionRate}% conversion`}
          color="green"
        />

        <StatCard
          icon={CheckCircle}
          title="Pending Activation"
          value={stats.pendingActivations.toLocaleString()}
          color="yellow"
        />

        <StatCard
          icon={CreditCard}
          title="Approved"
          value={stats.totalApproved.toLocaleString()}
          color="purple"
        />
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <QuickLink
          title="User Management"
          description="View and manage users"
          href="/admin/users"
          icon={Users}
        />
        <QuickLink
          title="Pending Approvals"
          description="Review pending approvals"
          href="/admin/approvals"
          icon={CheckCircle}
        />
        <QuickLink
          title="Transactions"
          description="View all transactions"
          href="/admin/transactions"
          icon={CreditCard}
        />
        <QuickLink
          title="Withdrawals"
          description="Manage withdrawals"
          href="/admin/withdrawals"
          icon={ArrowUp}
        />
        <QuickLink
          title="Blogs"
          description="Manage blog content"
          href="/admin/blogs"
          icon={FileText}
        />
        <QuickLink
          title="Surveys"
          description="Manage surveys"
          href="/admin/surveys"
          icon={BarChart3}
        />
      </div>
    </div>
  );
}

function QuickLink({
  title,
  description,
  href,
  icon: Icon,
}: {
  title: string;
  description: string;
  href: string;
  icon: typeof Users;
}) {
  return (
    <a
      href={href}
      className="bg-white rounded-lg shadow p-6 border border-slate-200 hover:shadow-lg hover:border-blue-300 transition-all duration-200 group"
    >
      <div className="flex items-start gap-3">
        <div className="p-2 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition-colors">
          <Icon size={24} className="text-blue-600" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
            {title}
          </h3>
          <p className="text-sm text-slate-600 mt-1">{description}</p>
        </div>
      </div>
    </a>
  );
}

// Import icons
import { FileText, BarChart3 } from 'lucide-react';
