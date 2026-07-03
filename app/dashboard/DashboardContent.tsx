'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  ClipboardCheck,
  Clock,
  Copy,
  DollarSign,
  Gift,
  Loader2,
  Share2,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  Users,
  X,
  ArrowRight,
  CheckCircle,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import SpinWheel from '@/app/ui/dashboard/spin-wheel';
import SurveyWalletCard from '@/app/ui/dashboard/SurveyWalletCard';
import { fetchDashboardData } from '@/app/lib/data';
import { useDashboard } from './DashboardContext';

// Type definitions
interface Profile {
  username: string;
  phone_number: string;
  referral_id: string | null;
  email: string;
  is_verified: boolean;
  is_active: boolean;
  is_approved: boolean;
  status: string;
  ban_reason: string | null;
  banned_at: string | null;
  suspension_reason: string | null;
  suspended_at: string | null;
  level: number;
  rank: string;
  total_earnings: number;
  tasks_completed: number;
  available_spins: number;
}

interface Stats {
  totalEarnings: number;
  availableBalance: number;
  pendingWithdrawals: number;
  referralCount: number;
  directReferralEarnings: number;
  downlineCount: number;
  downlineEarnings: number;
  level: number;
  rank: string;
  availableSpins: number;
  surveyEarnings: number;
  spinEarnings: number;
  taskEarnings?: number;
  bonusEarnings?: number;
  todayEarnings?: number;
  todayWithdrawals?: number;
  todayWithdrawalsCount?: number;
  totalSpins?: number;
  totalWins?: number;
  winRate?: number;
  currentStreak?: number;
  bestStreak?: number;
  totalSpinsUsed?: number;
}

interface Receipt {
  id: string;
  amount: number;
  date: string;
  transactionCode: string;
}

interface Transaction {
  id: string;
  amount: number;
  type: 'EARNING' | 'WITHDRAW' | 'DEPOSIT' | 'BONUS' | 'SPIN_WIN' | 'REFERRAL' | 'SURVEY' | string;
  description: string;
  status: string;
  date: string;
}

interface DashboardData {
  profile: Profile;
  stats: Stats;
  receipts: Receipt[];
  transactions: Transaction[];
}

interface DashboardContentProps {
  initialData: DashboardData;
}

export default function DashboardContent({ initialData }: DashboardContentProps) {
  const { user } = useDashboard();
  
  // useState: ephemeral UI state - spin message (rule 6)
  const [spinMessage, setSpinMessage] = useState<string | null>(null);
  // useState: ephemeral UI state - referral copy feedback (rule 6)
  const [referralMessage, setReferralMessage] = useState<string | null>(null);
  // useState: ephemeral UI state - modal trigger (rule 6)
  const [showSpinWheel, setShowSpinWheel] = useState(false);

  // React Query: reactive data fetching with caching and automatic refetch (rule 2)
  const { data: dashboardData = initialData, isPending: loading, error } = useQuery({
    queryKey: ['dashboard', user?.id],
    queryFn: async () => {
      if (!user) throw new Error('User not found');
      return fetchDashboardData(user.id);
    },
    enabled: !!user,
    initialData,
  });

  const handleSpinClick = () => {
    setShowSpinWheel(true);
    setSpinMessage('');
  };

  const handleSpinComplete = async (result: any) => {
    console.log('Spin completed with result:', result);

    if (result.success) {
      setSpinMessage(`Congratulations! You won: ${result.prizeName}`);
    } else {
      setSpinMessage(result.message || 'Spin completed. Better luck next time!');
    }

    setTimeout(() => {
      setShowSpinWheel(false);
    }, 3000);
  };

  const handleCopyReferralLink = async (referralId: string) => {
    try {
      const referralLink = `${window.location.origin}/auth/sign-up?ref=${referralId}`;
      await navigator.clipboard.writeText(referralLink);
      setReferralMessage('Referral link copied to clipboard!');
      setTimeout(() => setReferralMessage(null), 3000);
    } catch (err) {
      setReferralMessage('Failed to copy referral link.');
      setTimeout(() => setReferralMessage(null), 3000);
    }
  };

  if (!user) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-50/30">
        <div className="text-center">
          <div className="relative inline-flex">
            <Loader2 className="animate-spin text-blue-600 w-10 h-10" />
            <div className="absolute inset-0 animate-ping">
              <Loader2 className="text-cyan-400 w-10 h-10 opacity-20" />
            </div>
          </div>
          <p className="mt-3 text-lg font-medium text-slate-700">Loading user data...</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-50/30">
        <div className="text-center">
          <div className="relative inline-flex">
            <Loader2 className="animate-spin text-blue-600 w-10 h-10" />
            <div className="absolute inset-0 animate-ping">
              <Loader2 className="text-cyan-400 w-10 h-10 opacity-20" />
            </div>
          </div>
          <p className="mt-3 text-lg font-medium text-slate-700">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-red-50 via-orange-50/30 to-red-50/30">
        <div className="bg-white/80 backdrop-blur-xl border-2 border-red-200 text-red-700 p-6 rounded-2xl max-w-md shadow-xl">
          <div className="flex items-center mb-4">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mr-3">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <p className="font-semibold text-lg">Error loading dashboard</p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="w-full mt-4 py-2 px-4 bg-gradient-to-r from-red-600 to-red-500 text-white font-semibold rounded-xl hover:from-red-700 hover:to-red-600 shadow-lg shadow-red-500/30 transition-all duration-250"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const { profile, stats, receipts, transactions } = dashboardData || {};

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 md:p-8 min-h-screen relative">
      {/* Animated background elements */}
      <div className="absolute top-0 right-0 w-72 h-72 bg-gradient-to-bl from-purple-400/10 to-transparent rounded-full blur-3xl animate-pulse pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-72 h-72 bg-gradient-to-tr from-orange-400/10 to-transparent rounded-full blur-3xl animate-pulse delay-1000 pointer-events-none"></div>

      {/* Welcome Header */}
      <div className="relative mb-4 bg-white rounded-xl p-3 sm:p-4 shadow-lg border border-purple-400 overflow-hidden">
        {/* Accent bar */}
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-purple-500 to-purple-400"></div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-1">
              Welcome back, {profile?.username || 'User'}!
            </h1>
            <p className="text-sm text-slate-500">
              {new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>
          <div className="mt-3 sm:mt-0 flex items-center gap-2">
            {profile?.is_verified && (
              <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-medium">
                <CheckCircle className="w-4 h-4" />
                Verified
              </span>
            )}
            {profile?.is_approved && (
              <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">
                <ClipboardCheck className="w-4 h-4" />
                Approved
              </span>
            )}
          </div>
        </div>
      </div>

      {spinMessage && (
        <div className="mb-4 p-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-300 rounded-xl flex items-start gap-3">
          <Trophy className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-green-800 font-medium">{spinMessage}</p>
          </div>
          <button
            onClick={() => setSpinMessage(null)}
            className="text-green-600 hover:text-green-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {referralMessage && (
        <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-300 rounded-xl flex items-start gap-3">
          <Gift className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-blue-800 font-medium">{referralMessage}</p>
          </div>
          <button
            onClick={() => setReferralMessage(null)}
            className="text-blue-600 hover:text-blue-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        {/* Total Earnings */}
        <div className="bg-white rounded-xl p-4 shadow-lg border border-purple-200 hover:shadow-xl transition-shadow duration-300">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-slate-600 text-sm font-medium mb-1">Total Earnings</p>
              <p className="text-2xl sm:text-3xl font-bold text-slate-800">
                KES {stats?.totalEarnings?.toLocaleString() || 0}
              </p>
            </div>
            <div className="bg-gradient-to-br from-purple-400 to-purple-600 p-3 rounded-lg">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        {/* Available Balance */}
        <div className="bg-white rounded-xl p-4 shadow-lg border border-green-200 hover:shadow-xl transition-shadow duration-300">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-slate-600 text-sm font-medium mb-1">Available Balance</p>
              <p className="text-2xl sm:text-3xl font-bold text-slate-800">
                KES {stats?.availableBalance?.toLocaleString() || 0}
              </p>
            </div>
            <div className="bg-gradient-to-br from-green-400 to-green-600 p-3 rounded-lg">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        {/* Pending Withdrawals */}
        <div className="bg-white rounded-xl p-4 shadow-lg border border-orange-200 hover:shadow-xl transition-shadow duration-300">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-slate-600 text-sm font-medium mb-1">Pending Withdrawals</p>
              <p className="text-2xl sm:text-3xl font-bold text-slate-800">
                KES {stats?.pendingWithdrawals?.toLocaleString() || 0}
              </p>
            </div>
            <div className="bg-gradient-to-br from-orange-400 to-orange-600 p-3 rounded-lg">
              <Clock className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        {/* Referral Count */}
        <div className="bg-white rounded-xl p-4 shadow-lg border border-blue-200 hover:shadow-xl transition-shadow duration-300">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-slate-600 text-sm font-medium mb-1">Referrals</p>
              <p className="text-2xl sm:text-3xl font-bold text-slate-800">
                {stats?.referralCount || 0}
              </p>
            </div>
            <div className="bg-gradient-to-br from-blue-400 to-blue-600 p-3 rounded-lg">
              <Users className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Spin Wheel Section */}
      {stats?.availableSpins > 0 && (
        <div className="mb-6 bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50 rounded-xl p-4 sm:p-6 border border-purple-200 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-yellow-500" />
                Lucky Spin Wheel
              </h2>
              <p className="text-slate-600 text-sm mt-1">
                {stats.availableSpins} spins available!
              </p>
            </div>
            <button
              onClick={handleSpinClick}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-semibold shadow-lg shadow-purple-500/30 transition-all duration-300 flex items-center gap-2"
            >
              <Gift className="w-5 h-5" />
              Spin Now
            </button>
          </div>

          {showSpinWheel && (
            <div className="mt-6">
              <SpinWheel onSpinComplete={handleSpinComplete} userId={user.id} />
            </div>
          )}
        </div>
      )}

      {/* Survey Wallet */}
      <div className="mb-6">
        <SurveyWalletCard stats={stats} />
      </div>

      {/* Referral Program */}
      <div className="bg-white rounded-xl p-4 sm:p-6 shadow-lg border border-cyan-200 mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Share2 className="w-5 h-5 text-cyan-600" />
          Referral Program
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-lg p-4 border border-cyan-200">
            <p className="text-slate-600 text-sm mb-1">Direct Referrals</p>
            <p className="text-2xl font-bold text-slate-800">{stats?.referralCount || 0}</p>
            <p className="text-xs text-slate-500 mt-1">People you've referred</p>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200">
            <p className="text-slate-600 text-sm mb-1">Referral Earnings</p>
            <p className="text-2xl font-bold text-slate-800">
              KES {stats?.directReferralEarnings?.toLocaleString() || 0}
            </p>
            <p className="text-xs text-slate-500 mt-1">From direct referrals</p>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg p-4 border border-purple-200">
            <p className="text-slate-600 text-sm mb-1">Downline Earnings</p>
            <p className="text-2xl font-bold text-slate-800">
              KES {stats?.downlineEarnings?.toLocaleString() || 0}
            </p>
            <p className="text-xs text-slate-500 mt-1">From your network</p>
          </div>
        </div>

        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
          <p className="text-slate-700 text-sm font-medium mb-3">Your Referral Link</p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={`${typeof window !== 'undefined' ? window.location.origin : ''}/auth/sign-up?ref=${profile?.referral_id || ''}`}
              className="flex-1 bg-white border border-slate-300 rounded-lg px-4 py-2 text-sm text-slate-700 focus:outline-none"
            />
            <button
              onClick={() => handleCopyReferralLink(profile?.referral_id || '')}
              className="bg-cyan-600 hover:bg-cyan-700 text-white p-2 rounded-lg transition-colors duration-300"
            >
              <Copy className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Leaderboard Position */}
      <div className="bg-gradient-to-br from-amber-50 via-orange-50 to-red-50 rounded-xl p-4 sm:p-6 shadow-lg border border-amber-200 mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-600" />
          Leaderboard Position
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg p-4">
            <p className="text-slate-600 text-sm mb-2">Current Level</p>
            <p className="text-3xl font-bold text-slate-800">{stats?.level || 0}</p>
          </div>

          <div className="bg-white rounded-lg p-4">
            <p className="text-slate-600 text-sm mb-2">Rank</p>
            <p className="text-2xl font-bold text-amber-600">{stats?.rank || 'Beginner'}</p>
          </div>

          <div className="bg-white rounded-lg p-4">
            <p className="text-slate-600 text-sm mb-2">Tasks Completed</p>
            <p className="text-3xl font-bold text-slate-800">{profile?.tasks_completed || 0}</p>
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      {transactions && transactions.length > 0 && (
        <div className="bg-white rounded-xl p-4 sm:p-6 shadow-lg border border-slate-200">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-800 mb-4">Recent Transactions</h2>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Type</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Description</th>
                  <th className="text-right py-3 px-4 font-semibold text-slate-700">Amount</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Status</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Date</th>
                </tr>
              </thead>
              <tbody>
                {transactions.slice(0, 5).map((transaction) => (
                  <tr key={transaction.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 text-slate-700">{transaction.type}</td>
                    <td className="py-3 px-4 text-slate-700">{transaction.description}</td>
                    <td className="py-3 px-4 text-right font-semibold text-slate-800">
                      KES {transaction.amount.toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                          transaction.status === 'completed'
                            ? 'bg-green-100 text-green-700'
                            : transaction.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {transaction.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {new Date(transaction.date).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
