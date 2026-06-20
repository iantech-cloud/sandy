'use client';

import { useEffect, useState } from 'react';
import { ClipboardCheck, TrendingUp, AlertCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { getSurveyWallet } from '@/app/actions/survey-wallet';

interface SurveyWalletData {
  totalEarnings: number;
  availableBalance: number;
  surveysCompleted: number;
  lastSurveyDate: Date | null;
  canWithdraw: boolean;
}

export default function SurveyWalletCard() {
  const [data, setData] = useState<SurveyWalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadWallet = async () => {
      try {
        setLoading(true);
        const result = await getSurveyWallet();
        if (result.success && result.data) {
          setData(result.data);
        } else {
          setError(result.message || 'Failed to load wallet');
        }
      } catch (err) {
        setError('Error loading wallet');
      } finally {
        setLoading(false);
      }
    };

    loadWallet();
  }, []);

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-emerald-900">Survey Wallet</h3>
          <Loader2 className="w-5 h-5 text-emerald-600 animate-spin" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-gradient-to-br from-red-50 to-orange-50 border border-red-200 rounded-xl p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-red-900">Survey Wallet Error</h3>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-200 rounded-xl p-6">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-6 h-6 text-emerald-600" />
            <h3 className="text-lg font-semibold text-emerald-900">Survey Wallet</h3>
          </div>
          <TrendingUp className="w-5 h-5 text-green-600" />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Total Earnings */}
          <div className="bg-white rounded-lg p-4 border border-emerald-100">
            <p className="text-xs text-gray-600 font-medium mb-1">Total Earned</p>
            <p className="text-2xl font-bold text-emerald-600">
              KES {data.totalEarnings.toFixed(2)}
            </p>
          </div>

          {/* Surveys Completed */}
          <div className="bg-white rounded-lg p-4 border border-emerald-100">
            <p className="text-xs text-gray-600 font-medium mb-1">Surveys Done</p>
            <p className="text-2xl font-bold text-green-600">
              {data.surveysCompleted}
            </p>
          </div>

          {/* Available Balance */}
          <div className="bg-white rounded-lg p-4 border border-emerald-100">
            <p className="text-xs text-gray-600 font-medium mb-1">Available</p>
            <p className="text-2xl font-bold text-blue-600">
              KES {data.availableBalance.toFixed(2)}
            </p>
          </div>

          {/* Per Survey */}
          <div className="bg-white rounded-lg p-4 border border-emerald-100">
            <p className="text-xs text-gray-600 font-medium mb-1">Per Survey</p>
            <p className="text-2xl font-bold text-purple-600">KES 10</p>
          </div>
        </div>

        {/* Info Messages */}
        <div className="space-y-2">
          {data.lastSurveyDate && (
            <p className="text-xs text-emerald-700">
              Last survey: {new Date(data.lastSurveyDate).toLocaleDateString()}
            </p>
          )}
          
          {data.canWithdraw ? (
            <div className="bg-green-100 border border-green-300 rounded-lg p-3">
              <p className="text-sm text-green-800 font-medium">
                ✓ You can withdraw! Minimum KES 200 reached.
              </p>
            </div>
          ) : (
            <div className="bg-amber-100 border border-amber-300 rounded-lg p-3">
              <p className="text-sm text-amber-800 font-medium">
                Complete {Math.ceil((20000 - data.availableBalance * 100) / 1000)} more surveys to reach minimum withdrawal (KES 200)
              </p>
            </div>
          )}

          <p className="text-xs text-emerald-700 italic">
            Surveys available every Tuesday. Earn KES 10 per survey completion.
          </p>
        </div>

        {/* Action Button */}
        <Link
          href="/dashboard/surveys"
          className="w-full bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-lg py-3 font-medium hover:from-emerald-700 hover:to-green-700 transition-all duration-200 text-center block"
        >
          View Surveys
        </Link>
      </div>
    </div>
  );
}
