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

      {/* Welcome Header */}
      <div className="relative mb-4 bg-white rounded-xl p-3 sm:p-4 shadow-lg border border-purple-400 overflow-hidden">
        {/* Accent bar */}
        <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-purple-600"></div>
        
        <div className="relative z-10 flex items-center justify-between gap-3">
          <div className="flex items-center space-x-2 flex-1 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center shadow-md flex-shrink-0">
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 truncate">
                Welcome back, {profile?.username || 'User'}!
              </h2>
            </div>
          </div>
          <div className="flex items-center space-x-1.5 bg-purple-50 px-2.5 py-1.5 rounded-lg border border-purple-200 flex-shrink-0">
            <Trophy className="w-4 h-4 text-purple-600 flex-shrink-0" />
            <span className="text-xs sm:text-sm font-bold text-purple-700 whitespace-nowrap">Level {profile?.level}</span>
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
            <div className="grid grid-cols-1 gap-3 sm:gap-4">
              <div className="bg-indigo-600 rounded-lg px-4 py-4 shadow-sm">
                <div className="flex items-center gap-1.5 mb-2">
                  <DollarSign className="w-4 h-4 text-white/80" />
                  <span className="text-xs text-white/80 font-medium">Available Balance</span>
                </div>
                <p className="text-base font-bold text-white">KES {stats.availableBalance.toFixed(0)}</p>
              </div>
              <div className="bg-green-600 rounded-lg px-4 py-4 shadow-sm">
                <div className="flex items-center gap-1.5 mb-2">
                  <TrendingUp className="w-4 h-4 text-white/80" />
                  <span className="text-xs text-white/80 font-medium">Today&apos;s Earnings</span>
                </div>
                <p className="text-base font-bold text-white">KES {(stats.todayEarnings || 0).toFixed(0)}</p>
              </div>
              <div className="bg-purple-600 rounded-lg px-4 py-4 shadow-sm">
                <div className="flex items-center gap-1.5 mb-2">
                  <Trophy className="w-4 h-4 text-white/80" />
                  <span className="text-xs text-white/80 font-medium">Lifetime Earnings</span>
                </div>
                <p className="text-base font-bold text-white">KES {stats.totalEarnings.toFixed(0)}</p>
              </div>
              <div className="bg-yellow-500 rounded-lg px-4 py-4 shadow-sm">
                <div className="flex items-center gap-1.5 mb-2">
                  <Clock className="w-4 h-4 text-white/80" />
                  <span className="text-xs text-white/80 font-medium">Pending Withdrawal</span>
                </div>
                <p className="text-base font-bold text-white">KES {stats.pendingWithdrawals.toFixed(0)}</p>
              </div>
              <div className="bg-orange-500 rounded-lg px-4 py-4 shadow-sm">
                <div className="flex items-center gap-1.5 mb-2">
                  <ArrowRight className="w-4 h-4 text-white/80" />
                  <span className="text-xs text-white/80 font-medium">Today&apos;s Withdrawal</span>
                </div>
                <p className="text-base font-bold text-white">KES {(stats.todayWithdrawals || 0).toFixed(0)}</p>
              </div>
            </div>
          </div>

          {/* Earnings by Source - Small Containers */}
          <div className="mb-6 sm:mb-8">
            <h2 className="text-base sm:text-lg font-bold text-slate-800 mb-3 sm:mb-4 flex items-center">
              <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-green-600" />
              Earnings by Source
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:gap-4">
              <div className="flex flex-col justify-center gap-2 bg-blue-100 border border-blue-200 rounded-lg px-4 py-4">
                <div className="flex items-center gap-2">
                  <Share2 className="w-5 h-5 text-blue-600" />
                  <span className="text-sm text-blue-700 font-medium">Direct Referral</span>
                </div>
                <span className="text-base font-bold text-blue-800">KES {(stats.directReferralEarnings || 0).toFixed(0)}</span>
              </div>
              <div className="flex flex-col justify-center gap-2 bg-green-100 border border-green-200 rounded-lg px-4 py-4">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-green-600" />
                  <span className="text-sm text-green-700 font-medium">Downline Commission</span>
                </div>
                <span className="text-base font-bold text-green-800">KES {(stats.downlineEarnings || 0).toFixed(0)}</span>
              </div>
              <div className="flex flex-col justify-center gap-2 bg-pink-100 border border-pink-200 rounded-lg px-4 py-4">
                <div className="flex items-center gap-2">
                  <Gift className="w-5 h-5 text-pink-600" />
                  <span className="text-sm text-pink-700 font-medium">Spin Wallet Earnings</span>
                </div>
                <span className="text-base font-bold text-pink-800">KES {(stats.spinEarnings || 0).toFixed(0)}</span>
              </div>
              <div className="flex flex-col justify-center gap-2 bg-orange-100 border border-orange-200 rounded-lg px-4 py-4">
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="w-5 h-5 text-orange-600" />
                  <span className="text-sm text-orange-700 font-medium">Survey Earnings</span>
                </div>
                <span className="text-base font-bold text-orange-800">KES {(stats.surveyEarnings || 0).toFixed(0)}</span>
              </div>
              <div className="flex flex-col justify-center gap-2 bg-cyan-100 border border-cyan-200 rounded-lg px-4 py-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-cyan-600" />
                  <span className="text-sm text-cyan-700 font-medium">Task Earnings</span>
                </div>
                <span className="text-base font-bold text-cyan-800">KES {(stats.taskEarnings || 0).toFixed(0)}</span>
              </div>
              <div className="flex flex-col justify-center gap-2 bg-purple-100 border border-purple-200 rounded-lg px-4 py-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-600" />
                  <span className="text-sm text-purple-700 font-medium">Bonus Earnings</span>
                </div>
                <span className="text-base font-bold text-purple-800">KES {(stats.bonusEarnings || 0).toFixed(0)}</span>
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
        <div className="group relative bg-white rounded-xl p-3 sm:p-4 shadow-lg border border-red-400 hover:shadow-xl transition-all duration-300 overflow-hidden">
          {/* Accent bar */}
          <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-red-600"></div>
          <div className="relative z-10">
            <div className="flex items-center space-x-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-600 to-rose-500 flex items-center justify-center shadow-md flex-shrink-0">
                <Gift className="w-4 h-4 text-white" />
              </div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900">Spin-to-Win</h3>
            </div>
            
            <p className="text-slate-600 mb-2 text-[11px] sm:text-xs">Try your luck and win prizes!</p>
            
            <button
              onClick={handleSpinClick}
              disabled={refreshingStats}
              className="w-full py-2 px-3 bg-gradient-to-r from-red-600 to-rose-600 text-white font-semibold text-xs sm:text-sm rounded-lg shadow-md hover:shadow-lg transition-all duration-250 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {refreshingStats ? (
                <>
                  <Loader2 className="animate-spin mr-1.5" size={14} />
                  <span>Loading...</span>
                </>
              ) : (
                <>
                  <Gift className="mr-1.5" size={14} />
                  <span>Open Spin Wheel</span>
                </>
              )}
            </button>
            
            {spinMessage && (
              <div className={`mt-2 p-2 rounded-lg text-center font-medium text-[11px] ${
                spinMessage.includes('Congratulations')
                  ? 'bg-green-100 text-green-700 border border-green-200'
                  : spinMessage.includes('Not enough')
                  ? 'bg-red-100 text-red-700 border border-red-200'
                  : 'bg-blue-100 text-blue-700 border border-blue-200'
              }`}>
                {spinMessage}
              </div>
            )}
          </div>
        </div>

        {/* Wallet Pay Card */}
        <div className="group relative bg-white rounded-xl p-3 sm:p-4 shadow-lg border border-blue-400 hover:shadow-xl transition-all duration-300 overflow-hidden">
          {/* Accent bar */}
          <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-blue-600"></div>
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
        <div className="group relative bg-white rounded-xl p-3 sm:p-4 shadow-lg border border-cyan-400 hover:shadow-xl transition-all duration-300 overflow-hidden">
          {/* Accent bar */}
          <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-cyan-600"></div>
          <div className="relative z-10">
            <div className="flex items-center space-x-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-600 to-cyan-500 flex items-center justify-center shadow-md flex-shrink-0">
                <Share2 className="w-4 h-4 text-white" />
              </div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900">Refer & Earn</h3>
            </div>
            <p className="text-slate-600 mb-2 text-[11px] sm:text-xs">Share your referral link to earn bonuses</p>
            <div className="space-y-2">
              {profile?.referral_id && (
                <div className="bg-gradient-to-br from-teal-50 to-cyan-50 p-2 sm:p-3 rounded-lg border border-teal-200">
                  <p className="text-[10px] text-teal-700 mb-1 uppercase tracking-wide font-semibold">Your Referral Link</p>
                  <p className="text-[10px] sm:text-[11px] font-medium text-teal-600 mb-2 font-mono break-all leading-tight">
                    {typeof window !== 'undefined' ? `${window.location.origin}/auth/register?ref=${profile.referral_id}` : `/auth/register?ref=${profile.referral_id}`}
                  </p>
                  <button
                    onClick={() => handleCopyReferralLink(profile.referral_id!)}
                    className="w-full py-1.5 px-2 text-[11px] sm:text-xs bg-gradient-to-r from-teal-600 to-cyan-500 text-white font-semibold rounded-lg shadow-sm hover:shadow-md transition-all duration-250 flex items-center justify-center"
                  >
                    <Copy className="w-3 h-3 mr-1.5" />
                    Copy Link
                  </button>
                </div>
              )}
            </div>
            {referralMessage && (
              <div className={`mt-2 p-2 rounded-lg text-center font-medium text-[11px] ${
                referralMessage.includes('copied')
                  ? 'bg-green-100 text-green-700 border border-green-200'
                  : 'bg-blue-100 text-blue-700 border border-blue-200'
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
