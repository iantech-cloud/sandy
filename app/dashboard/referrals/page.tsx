// app/dashboard/referrals/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import Alert from '@/app/ui/Alert';
import { useDashboard } from '../DashboardContext';
import { getReferralCommissionStats, getReferralInfo } from '@/app/actions/referrals';
import { maskEmail } from '@/app/lib/email-utils';

interface Referral {
  id: string;
  name: string;
  email: string;
  joinDate: string;
  status: 'active' | 'pending' | 'suspended' | 'banned';
  earnings: number;
  level?: number;
  rank?: string;
  referredUser?: string;
  earning?: number;
  activationStatus: string;
  referralCount: number;
}

interface CommissionStats {
  level1: {
    totalEarnings: number;
    count: number;
  };
  level2: {
    totalEarnings: number;
    count: number;
  };
  total: number;
}

interface ReferralsResponse {
  success: boolean;
  data?: Referral[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  message: string;
}

export default function ReferralsPage() {
  const { user } = useDashboard();
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [commissionStats, setCommissionStats] = useState<CommissionStats | null>(null);
  const [referralLink, setReferralLink] = useState<string>('');
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info');
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalReferrals, setTotalReferrals] = useState(0);
  const ITEMS_PER_PAGE = 20;

  const fetchReferrals = async (page: number) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/referrals?page=${page}&limit=${ITEMS_PER_PAGE}`);
      const result: ReferralsResponse = await response.json();

      if (result.success && result.data) {
        const transformedReferrals = result.data.map(ref => ({
          ...ref,
          earnings: ref.earnings || ref.earning || 0,
          referredUser: ref.name || ref.email || 'Unknown User'
        }));
        setReferrals(transformedReferrals);
        
        if (result.pagination) {
          setTotalPages(result.pagination.pages);
          setTotalReferrals(result.pagination.total);
        }
      } else {
        setMessage(result.message || 'Failed to load referrals.');
        setMessageType('error');
      }
    } catch (error) {
      console.error('[v0] Error fetching referrals:', error);
      setMessage('An error occurred while loading referrals.');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setStatsLoading(true);

        // Fetch commission stats and referral info in parallel
        const [statsResult, infoResult] = await Promise.all([
          getReferralCommissionStats(),
          getReferralInfo()
        ]);

        if (statsResult.success && statsResult.data) {
          setCommissionStats(statsResult.data);
        } else {
          console.error('Failed to load commission stats:', statsResult.message);
        }

        if (infoResult.success && infoResult.data) {
          const code = infoResult.data.referralCode;
          const origin = typeof window !== 'undefined' ? window.location.origin : '';
          setReferralLink(`${origin}/auth/sign-up?ref=${code}`);
        }

      } catch (error) {
        console.error('[v0] Error fetching data:', error);
        setMessage('An error occurred while loading data.');
        setMessageType('error');
      } finally {
        setStatsLoading(false);
      }
    };
    
    fetchData();
  }, []);

  // Fetch referrals when page changes or on mount
  useEffect(() => {
    fetchReferrals(currentPage);
  }, [currentPage]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setMessage(`${label} copied to clipboard!`);
    setMessageType('success');
    setTimeout(() => setMessage(null), 3000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="bg-white p-6 rounded-xl shadow-lg mb-8">
            <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
            <div className="h-6 bg-gray-200 rounded w-1/2"></div>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-200 rounded mb-4 last:mb-0"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <h2 className="text-3xl font-extrabold text-gray-800 mb-6 border-b pb-2">Referrals</h2>
      
      {message && <Alert type={messageType} message={message} onClose={() => setMessage(null)} />}
      
      {/* Referral Code & Link Section */}
      <div className="bg-white p-6 rounded-xl shadow-lg mb-8">
        <h3 className="font-bold text-lg mb-4 text-gray-800">Your Referral Information</h3>
        
        {/* Referral Code */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Referral Code</label>
          <div className="flex items-center gap-4 flex-wrap">
            <code className="text-lg lg:text-xl font-mono text-indigo-600 bg-indigo-50 px-4 py-2 rounded-lg border-2 border-indigo-200 break-all">
              {referralLink && referralLink.includes('ref=') ? referralLink.split('ref=')[1]?.split('&')[0] : 'Loading...'}
            </code>
            <button
              onClick={() => {
                if (referralLink && referralLink.includes('ref=')) {
                  const code = referralLink.split('ref=')[1]?.split('&')[0];
                  if (code) {
                    copyToClipboard(code, 'Referral code');
                  }
                }
              }}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors whitespace-nowrap flex-shrink-0"
            >
              Copy Code
            </button>
          </div>
        </div>

        {/* Referral Link */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Referral Link</label>
          <div className="flex items-center gap-4 flex-wrap">
            <input
              type="text"
              readOnly
              value={referralLink || 'Loading...'}
              className="flex-1 px-4 py-2 text-sm bg-gray-50 border border-gray-300 rounded-lg font-mono text-gray-600 break-all"
            />
            <button
              onClick={() => {
                if (referralLink) {
                  copyToClipboard(referralLink, 'Referral link');
                }
              }}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap flex-shrink-0"
            >
              Copy Link
            </button>
          </div>
        </div>

        <p className="text-gray-600 mt-4 text-sm">
          Share your referral link. Earn <strong>KES 65</strong> (Level 1) when someone you refer activates, plus <strong>KES 10</strong> (Level 2) when your referred member&apos;s referral activates. For Chat Foreigners, earn <strong>KES 70</strong> (L1) and <strong>KES 10</strong> (L2) per personality unlock.
        </p>
      </div>

      {/* Commission Breakdown Section */}
      <div className="bg-white p-6 rounded-xl shadow-lg mb-8">
        <h3 className="font-bold text-lg mb-4 text-gray-800">Commission Breakdown</h3>
        
        {statsLoading ? (
          <div className="animate-pulse">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="text-center p-4 bg-gray-100 rounded-lg">
                  <div className="h-8 bg-gray-200 rounded mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded"></div>
                </div>
              ))}
            </div>
          </div>
        ) : commissionStats ? (
          <div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              {/* Level 1 earnings */}
              <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="text-2xl font-bold text-green-600">
                  KES {commissionStats.level1.totalEarnings.toFixed(2)}
                </div>
                <div className="text-sm text-gray-600 mt-1">Level 1 Earnings</div>
                <div className="text-xs text-green-500 mt-1">{commissionStats.level1.count} commission{commissionStats.level1.count !== 1 ? 's' : ''}</div>
              </div>

              {/* Level 2 earnings */}
              <div className="text-center p-4 bg-amber-50 rounded-lg border border-amber-200">
                <div className="text-2xl font-bold text-amber-600">
                  KES {commissionStats.level2 ? commissionStats.level2.totalEarnings.toFixed(2) : '0.00'}
                </div>
                <div className="text-sm text-gray-600 mt-1">Level 2 Earnings</div>
                <div className="text-xs text-amber-500 mt-1">{commissionStats.level2?.count ?? 0} commission{(commissionStats.level2?.count ?? 0) !== 1 ? 's' : ''}</div>
              </div>

              {/* Total */}
              <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="text-2xl font-bold text-blue-600">
                  KES {commissionStats.total.toFixed(2)}
                </div>
                <div className="text-sm text-gray-600 mt-1">Total Referral Earnings</div>
                <div className="text-xs text-blue-500 mt-1">All tiers combined</div>
              </div>
            </div>

          {/* Commission Structure Info */}
            <div className="p-4 bg-gray-50 rounded-lg border">
              <h4 className="font-semibold text-gray-800 mb-3">Commission Structure</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                {/* Activation */}
                <div>
                  <p className="font-medium text-gray-700 mb-2">Account Activation (KES 95 fee)</p>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 bg-green-500 rounded-full flex-shrink-0"></div>
                      <span>Level 1: <strong>KES 65</strong></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 bg-amber-500 rounded-full flex-shrink-0"></div>
                      <span>Level 2: <strong>KES 10</strong></span>
                    </div>
                  </div>
                </div>
                {/* Chat Foreigners */}
                <div>
                  <p className="font-medium text-gray-700 mb-2">Chat Foreigners Unlock (KES 100 fee)</p>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 bg-green-500 rounded-full flex-shrink-0"></div>
                      <span>Level 1: <strong>KES 70</strong></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 bg-amber-500 rounded-full flex-shrink-0"></div>
                      <span>Level 2: <strong>KES 10</strong></span>
                    </div>
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-4">
                All earnings go directly to your main wallet and are withdrawable.
              </p>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <svg className="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <p>Commission data not available</p>
          </div>
        )}
      </div>

      {/* Referrals List Section */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="bg-gray-50 px-6 py-4 border-b">
          <h3 className="text-lg font-semibold text-gray-800">Your Referral Network</h3>
        </div>
        
        {referrals.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-gray-400 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <p className="text-gray-500 text-lg mb-2">No referrals yet</p>
            <p className="text-gray-400 text-sm">Start sharing your referral link to grow your network!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Name</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Email</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Activated</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Joined</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Referrals</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Your Earning</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {referrals.map((ref) => (
                  <tr key={ref.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{ref.name || 'Unknown User'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {maskEmail(ref.email, 2)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        ref.status === 'active' 
                          ? 'bg-green-100 text-green-800' 
                          : ref.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {ref.status?.charAt(0).toUpperCase() + ref.status?.slice(1) || 'Unknown'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        ref.activationStatus === 'activated'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-500'
                      }`}>
                        {ref.activationStatus === 'activated' ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {ref.joinDate ? new Date(ref.joinDate).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{ref.referralCount || 0}</td>
                    <td className="px-4 py-3 text-sm font-bold text-green-600 text-right">
                      KES {(ref.earnings || 0).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls - Mobile Responsive */}
        {totalReferrals > ITEMS_PER_PAGE && (
          <div className="border-t bg-gray-50 px-4 md:px-6 py-4">
            <div className="text-xs md:text-sm text-gray-600 mb-3 flex items-center justify-between">
              <span>
                Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, totalReferrals)} of {totalReferrals} referrals
              </span>
              {loading && <Loader2 size={16} className="animate-spin" />}
            </div>
            <div className="flex flex-col md:flex-row items-center gap-2 md:gap-4 md:justify-between">
              <div className="flex items-center gap-1 md:gap-2 flex-wrap justify-center md:justify-start">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1 || loading}
                  className="flex items-center gap-1 px-2 md:px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs md:text-sm"
                >
                  <ChevronLeft size={14} className="md:w-4 md:h-4" />
                  <span className="hidden sm:inline">Prev</span>
                </button>
                
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                    // Show only current page and nearby pages on mobile
                    if (totalPages > 5 && Math.abs(page - currentPage) > 1 && page !== 1 && page !== totalPages) {
                      return null;
                    }
                    return (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        disabled={loading}
                        className={`px-2 md:px-3 py-2 rounded-lg transition-colors text-xs md:text-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                          currentPage === page
                            ? 'bg-blue-600 text-white'
                            : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        {page}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages || loading}
                  className="flex items-center gap-1 px-2 md:px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs md:text-sm"
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight size={14} className="md:w-4 md:h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Stats Summary - Shows totals from database */}
      {totalReferrals > 0 && (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
            <div className="text-sm text-gray-500 mb-1">Total Referrals</div>
            <div className="text-3xl font-bold text-gray-800">{totalReferrals}</div>
            <div className="text-xs text-gray-400 mt-1">All time</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow border border-green-200">
            <div className="text-sm text-gray-500 mb-1">Activated Users</div>
            <div className="text-3xl font-bold text-green-600">
              {referrals.filter(ref => ref.activationStatus === 'activated').length}/{referrals.length}
            </div>
            <div className="text-xs text-gray-400 mt-1">On this page</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow border border-blue-200">
            <div className="text-sm text-gray-500 mb-1">Active Referrals</div>
            <div className="text-3xl font-bold text-blue-600">
              {referrals.filter(ref => ref.status === 'active').length}/{referrals.length}
            </div>
            <div className="text-xs text-gray-400 mt-1">On this page</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow border border-purple-200">
            <div className="text-sm text-gray-500 mb-1">Total Referral Earnings</div>
            <div className="text-3xl font-bold text-purple-600">
              KES {commissionStats ? commissionStats.total.toFixed(2) : '0.00'}
            </div>
            <div className="text-xs text-gray-400 mt-1">L1 + L2 combined</div>
          </div>
        </div>
      )}
    </div>
  );
}
