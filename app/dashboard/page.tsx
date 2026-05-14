// app/dashboard/page.tsx - FULLY MODERNIZED
"use client";

import { useState, useEffect } from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  CheckCircle, 
  Users, 
  Loader2, 
  AlertTriangle, 
  Gift, 
  Share2, 
  ClipboardCheck,
  Clock,
  X,
  ArrowRight,
  BarChart3,
  Sparkles,
  Trophy,
  Target,
  Copy
} from 'lucide-react';

import TransactionHistory from '@/app/ui/dashboard/TransactionHistory';
import WalletPay from '@/app/ui/dashboard/WalletPay';
import SpinWheel from '@/app/ui/dashboard/spin-wheel';
import UserReports from '@/app/ui/dashboard/userReports';
import { fetchDashboardData } from '@/app/lib/data';
import { useDashboard } from './DashboardContext';
import TransactionTrendsChart from '@/app/ui/dashboard/chart';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

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



// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function DashboardPage() {
  const { user } = useDashboard();
  const [spinMessage, setSpinMessage] = useState<string | null>(null);
  const [referralMessage, setReferralMessage] = useState<string | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [showSpinWheel, setShowSpinWheel] = useState(false);
  const [refreshingStats, setRefreshingStats] = useState(false);

  useEffect(() => {
    if (!user) return;

    const loadDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchDashboardData(user.id);
        setDashboardData(data);
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
        setError('Failed to load dashboard data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, [user]);

  

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

    if (user) {
      try {
        setRefreshingStats(true);
        const updatedDashboardData = await fetchDashboardData(user.id);
        setDashboardData(updatedDashboardData);
      } catch (err) {
        console.error('Failed to refresh data after spin:', err);
      } finally {
        setRefreshingStats(false);
      }
    }

    setTimeout(() => {
      setShowSpinWheel(false);
    }, 3000);
  };

  const handleCopyReferralLink = async (referralId: string) => {
    try {
      const referralLink = `${window.location.origin}/auth/register?ref=${referralId}`;
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
            <p className="font-semibold text-lg">{error}</p>
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

      {/* Welcome Header with Bold Design */}
      <div className="relative mb-6 bg-white rounded-2xl p-4 sm:p-6 lg:p-8 shadow-xl border-2 border-purple-500 overflow-hidden group hover:shadow-2xl hover:scale-105 hover:-translate-y-1 transition-all duration-300">
        {/* Accent bar */}
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-purple-600"></div>
        
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/50 group-hover:shadow-purple-500/70 transition-all duration-300 group-hover:scale-110 flex-shrink-0">
              <Sparkles className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900 truncate">
                Welcome back, {profile?.username || 'User'}!
              </h2>
              <p className="text-slate-600 mt-1 text-xs sm:text-sm hidden sm:block">Here's what's happening with your account today</p>
            </div>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-3 bg-purple-50 px-3 sm:px-5 py-2 sm:py-3 rounded-xl border border-purple-200 flex-shrink-0">
            <Trophy className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600 flex-shrink-0" />
            <span className="text-sm sm:text-base lg:text-lg font-bold text-purple-700 whitespace-nowrap">Level {profile?.level}</span>
          </div>
        </div>
      </div>

      {/* Earning Summary - Compact Cards */}
      {stats ? (
        <>
          <div className="mb-6 sm:mb-8">
            <h2 className="text-base sm:text-lg font-bold text-slate-800 mb-3 sm:mb-4 flex items-center">
              <Target className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-indigo-600" />
              Earning Summary
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
              <div className="bg-indigo-600 rounded-xl p-3 shadow-md">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="w-4 h-4 text-white/80" />
                  <span className="text-xs text-white/80 font-medium">Available</span>
                </div>
                <p className="text-lg font-bold text-white">KES {stats.availableBalance.toFixed(0)}</p>
              </div>
              <div className="bg-green-600 rounded-xl p-3 shadow-md">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-4 h-4 text-white/80" />
                  <span className="text-xs text-white/80 font-medium">Today</span>
                </div>
                <p className="text-lg font-bold text-white">KES {(stats.todayEarnings || 0).toFixed(0)}</p>
              </div>
              <div className="bg-purple-600 rounded-xl p-3 shadow-md">
                <div className="flex items-center gap-2 mb-1">
                  <Trophy className="w-4 h-4 text-white/80" />
                  <span className="text-xs text-white/80 font-medium">Lifetime</span>
                </div>
                <p className="text-lg font-bold text-white">KES {stats.totalEarnings.toFixed(0)}</p>
              </div>
              <div className="bg-yellow-500 rounded-xl p-3 shadow-md">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-4 h-4 text-white/80" />
                  <span className="text-xs text-white/80 font-medium">Pending W/D</span>
                </div>
                <p className="text-lg font-bold text-white">KES {stats.pendingWithdrawals.toFixed(0)}</p>
              </div>
              <div className="bg-orange-500 rounded-xl p-3 shadow-md">
                <div className="flex items-center gap-2 mb-1">
                  <ArrowRight className="w-4 h-4 text-white/80" />
                  <span className="text-xs text-white/80 font-medium">Today W/D</span>
                </div>
                <p className="text-lg font-bold text-white">KES {(stats.todayWithdrawals || 0).toFixed(0)}</p>
              </div>
            </div>
          </div>

          {/* Earnings by Source - Small Containers */}
          <div className="mb-6 sm:mb-8">
            <h2 className="text-base sm:text-lg font-bold text-slate-800 mb-3 sm:mb-4 flex items-center">
              <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-green-600" />
              Earnings by Source
            </h2>
            <div className="flex flex-wrap gap-2 sm:gap-3">
              <div className="flex items-center gap-2 bg-blue-100 border border-blue-200 rounded-lg px-3 py-2">
                <Share2 className="w-4 h-4 text-blue-600" />
                <span className="text-xs text-blue-700 font-medium">Direct Referral</span>
                <span className="text-sm font-bold text-blue-800">KES {(stats.directReferralEarnings || 0).toFixed(0)}</span>
              </div>
              <div className="flex items-center gap-2 bg-green-100 border border-green-200 rounded-lg px-3 py-2">
                <Users className="w-4 h-4 text-green-600" />
                <span className="text-xs text-green-700 font-medium">Downline</span>
                <span className="text-sm font-bold text-green-800">KES {(stats.downlineEarnings || 0).toFixed(0)}</span>
              </div>
              <div className="flex items-center gap-2 bg-pink-100 border border-pink-200 rounded-lg px-3 py-2">
                <Gift className="w-4 h-4 text-pink-600" />
                <span className="text-xs text-pink-700 font-medium">Spin Wallet</span>
                <span className="text-sm font-bold text-pink-800">KES {(stats.spinEarnings || 0).toFixed(0)}</span>
              </div>
              <div className="flex items-center gap-2 bg-orange-100 border border-orange-200 rounded-lg px-3 py-2">
                <ClipboardCheck className="w-4 h-4 text-orange-600" />
                <span className="text-xs text-orange-700 font-medium">Survey</span>
                <span className="text-sm font-bold text-orange-800">KES {(stats.surveyEarnings || 0).toFixed(0)}</span>
              </div>
              <div className="flex items-center gap-2 bg-cyan-100 border border-cyan-200 rounded-lg px-3 py-2">
                <CheckCircle className="w-4 h-4 text-cyan-600" />
                <span className="text-xs text-cyan-700 font-medium">Task</span>
                <span className="text-sm font-bold text-cyan-800">KES {(stats.taskEarnings || 0).toFixed(0)}</span>
              </div>
              <div className="flex items-center gap-2 bg-purple-100 border border-purple-200 rounded-lg px-3 py-2">
                <Sparkles className="w-4 h-4 text-purple-600" />
                <span className="text-xs text-purple-700 font-medium">Bonus</span>
                <span className="text-sm font-bold text-purple-800">KES {(stats.bonusEarnings || 0).toFixed(0)}</span>
              </div>
            </div>
          </div>
        </>
      ) : (
        <p className="text-center text-slate-500 mb-8 py-12 bg-white rounded-2xl shadow-md border border-slate-200">No statistics available.</p>
      )}

      {/* Section Divider */}
      <div className="my-10">
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t-2 border-gradient-to-r from-transparent via-slate-300 to-transparent"></div>
          </div>
        </div>
      </div>

      {/* Quick Actions Grid with Enhanced Styling */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        {/* Spin-to-Win Card */}
        <div className="group relative bg-white rounded-2xl p-4 sm:p-6 shadow-xl border-2 border-red-500 hover:shadow-2xl transition-all duration-300 overflow-hidden hover:scale-105 hover:-translate-y-1">
          {/* Accent bar */}
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-600"></div>
          <div className="relative z-10">
            <div className="flex items-center space-x-2 sm:space-x-3 mb-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-red-600 to-rose-500 flex items-center justify-center shadow-lg shadow-red-500/40 group-hover:shadow-red-500/60 transition-all duration-300 group-hover:rotate-12 flex-shrink-0">
                <Gift className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900">Spin-to-Win</h3>
            </div>
            
            <p className="text-slate-600 mb-4 text-xs sm:text-sm">Try your luck and win exciting prizes!</p>
            
            <button
              onClick={handleSpinClick}
              disabled={refreshingStats}
              className="w-full py-2.5 sm:py-3 px-4 sm:px-6 bg-gradient-to-r from-red-600 to-rose-600 text-white font-bold text-sm sm:text-base rounded-xl shadow-lg shadow-red-500/40 hover:shadow-xl hover:shadow-red-500/50 transition-all duration-250 flex items-center justify-center transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {refreshingStats ? (
                <>
                  <Loader2 className="animate-spin mr-2" size={16} />
                  <span className="hidden sm:inline">Refreshing...</span>
                  <span className="sm:hidden">Loading...</span>
                </>
              ) : (
                <>
                  <Gift className="mr-2" size={18} />
                  <span className="hidden sm:inline">Open Spin Wheel</span>
                  <span className="sm:hidden">Spin</span>
                  <ArrowRight className="ml-2 hidden sm:inline" size={16} />
                </>
              )}
            </button>
            
            {spinMessage && (
              <div className={`mt-4 p-3 rounded-xl text-center font-medium text-sm backdrop-blur-sm ${
                spinMessage.includes('Congratulations')
                  ? 'bg-green-100/80 text-green-700 border border-green-300'
                  : spinMessage.includes('Not enough')
                  ? 'bg-red-100/80 text-red-700 border border-red-300'
                  : 'bg-blue-100/80 text-blue-700 border border-blue-300'
              }`}>
                {spinMessage}
              </div>
            )}
          </div>
        </div>

        {/* Wallet Pay Card */}
        <div className="group relative bg-white rounded-2xl p-4 sm:p-6 shadow-xl border-2 border-blue-500 hover:shadow-2xl transition-all duration-300 overflow-hidden hover:scale-105 hover:-translate-y-1">
          {/* Accent bar */}
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600"></div>
          <div className="relative z-10">
            <WalletPay 
              onDepositSuccess={() => {
                if (user) {
                  fetchDashboardData(user.id).then(setDashboardData);
                }
              }} 
            />
          </div>
        </div>

        {/* Referral Card */}
        <div className="group relative bg-white rounded-2xl p-4 sm:p-6 shadow-xl border-2 border-cyan-500 hover:shadow-2xl transition-all duration-300 overflow-hidden hover:scale-105 hover:-translate-y-1">
          {/* Accent bar */}
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-cyan-600"></div>
          <div className="relative z-10">
            <div className="flex items-center space-x-2 sm:space-x-3 mb-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-teal-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-teal-500/40 group-hover:shadow-teal-500/60 transition-all duration-300 flex-shrink-0">
                <Share2 className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900">Refer & Earn</h3>
            </div>
            <p className="text-slate-600 mb-4 text-xs sm:text-sm">Share your referral link to earn bonuses</p>
            <div className="space-y-3">
              {profile?.referral_id && (
                <div className="bg-gradient-to-br from-teal-100 to-cyan-100 p-3 sm:p-4 rounded-2xl border border-teal-300">
                  <p className="text-xs text-teal-700 mb-2 uppercase tracking-wide font-semibold">Your Referral Link</p>
                  <p className="text-xs sm:text-sm font-medium bg-gradient-to-r from-teal-600 to-cyan-600 bg-clip-text text-transparent mb-3 font-mono break-all">
                    {typeof window !== 'undefined' ? `${window.location.origin}/auth/register?ref=${profile.referral_id}` : `/auth/register?ref=${profile.referral_id}`}
                  </p>
                  <button
                    onClick={() => handleCopyReferralLink(profile.referral_id!)}
                    className="w-full py-2 px-3 sm:px-4 text-xs sm:text-sm bg-gradient-to-r from-teal-600 to-cyan-500 text-white font-semibold rounded-xl hover:from-teal-700 hover:to-cyan-600 shadow-lg shadow-teal-500/40 hover:shadow-teal-500/50 transition-all duration-250 transform hover:scale-105 flex items-center justify-center"
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copy Link
                  </button>
                </div>
              )}
            </div>
            {referralMessage && (
              <div className={`mt-4 p-3 rounded-xl text-center font-medium text-sm backdrop-blur-sm ${
                referralMessage.includes('copied')
                  ? 'bg-green-100/80 text-green-700 border border-green-300'
                  : 'bg-blue-100/80 text-blue-700 border border-blue-300'
              }`}>
                {referralMessage}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Section Divider */}
      <div className="my-10">
        <div className="w-full h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent"></div>
      </div>

      {/* Financial Reports Section */}
      <div className="mb-8">
        <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
          <BarChart3 className="w-5 h-5 mr-2 text-cyan-600" />
          Financial Reports
        </h2>
        <UserReports className="mt-6" />
      </div>

      {/* Spin Wheel Modal with Enhanced Design */}
      {showSpinWheel && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border-2 border-white/50">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold bg-gradient-to-r from-red-600 to-pink-600 bg-clip-text text-transparent flex items-center">
                  <Sparkles className="mr-2 text-red-500" />
                  Spin to Win!
                </h2>
                <button
                  onClick={() => setShowSpinWheel(false)}
                  className="text-slate-500 hover:text-slate-700 transition-all duration-200 transform hover:scale-110 hover:rotate-90 w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center"
                >
                  <X size={24} />
                </button>
              </div>

              <SpinWheel 
                userId={user.id}
                onSpinComplete={handleSpinComplete}
              />
            </div>
          </div>
        </div>
      )}

      {/* Transaction Trends */}
      <div className="mb-8">
        <TransactionTrendsChart timeRange="30days" />
      </div>

      {/* Approved Withdrawals with Modern Design */}
      <div className="bg-white/70 backdrop-blur-xl p-6 rounded-3xl shadow-lg border border-white/50 mb-8">
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-600 to-green-500 flex items-center justify-center shadow-lg shadow-green-500/30">
            <CheckCircle className="w-5 h-5 text-white" />
          </div>
          <h3 className="text-2xl font-bold text-slate-900">Approved Withdrawals</h3>
        </div>
        {receipts && receipts.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <DollarSign className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-slate-500">No approved withdrawals found.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-200">
            {receipts?.map((receipt) => (
              <li key={receipt.id} className="flex justify-between items-center py-4 px-4 hover:bg-white/50 transition-all duration-250 rounded-xl group">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-100 to-cyan-100 flex items-center justify-center group-hover:scale-110 transition-transform duration-250">
                    <CheckCircle className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Transaction ID: {receipt.transactionCode}</p>
                    <p className="text-sm text-slate-500">
                      {new Date(receipt.date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold bg-gradient-to-r from-green-600 to-green-500 bg-clip-text text-transparent">
                    KES {receipt.amount.toFixed(2)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Transaction History */}
      <div className="mb-8">
        <TransactionHistory 
          transactions={transactions as any || []} 
          title="Recent Activity" 
          limit={10} 
        />
      </div>
    </div>
  );
}
