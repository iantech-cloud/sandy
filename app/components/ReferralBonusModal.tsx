'use client';

import { useState, useEffect } from 'react';
import { X, Gift, Users, CheckCircle, Loader2 } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { checkAndApplyReferralBonus } from '@/app/actions/referrals';

interface ReferralBonusModalProps {
  isOpen: boolean;
  isLoggedIn?: boolean;
  onClose: () => void;
  onBonusApplied?: () => void;
}

export default function ReferralBonusModal({
  isOpen,
  isLoggedIn = false,
  onClose,
  onBonusApplied,
}: ReferralBonusModalProps) {
  const { data: session } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [bonusStatus, setBonusStatus] = useState<'pending' | 'checking' | 'qualified' | 'unqualified'>('pending');
  const [referralCount, setReferralCount] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  // Check bonus eligibility when modal opens (only for logged-in users)
  useEffect(() => {
    if (!isOpen || !isLoggedIn || !session?.user) return;

    const checkBonus = async () => {
      setIsLoading(true);
      setBonusStatus('checking');
      try {
        const result = await checkAndApplyReferralBonus();
        if (result.success) {
          setBonusStatus('qualified');
          setReferralCount(result.referralCount || 0);
          onBonusApplied?.();
        } else {
          setBonusStatus('unqualified');
          setReferralCount(result.referralCount || 0);
        }
      } catch (error) {
        console.error('[v0] Error checking bonus:', error);
        setBonusStatus('unqualified');
      } finally {
        setIsLoading(false);
      }
    };

    checkBonus();
  }, [isOpen, isLoggedIn, session?.user, onBonusApplied]);

  const handleClose = () => {
    setDismissed(true);
    onClose();
  };

  if (!isOpen || dismissed) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
      <div className="bg-gradient-to-br from-white via-purple-50 to-pink-50 rounded-2xl max-w-md w-full p-7 shadow-2xl border border-purple-200 relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-purple-200/30 to-transparent rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-pink-200/30 to-transparent rounded-full blur-3xl pointer-events-none"></div>

        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-5 right-5 text-gray-500 hover:text-gray-700 transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Content */}
        <div className="relative z-10">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-purple-600 to-pink-500 rounded-full flex items-center justify-center shadow-lg">
              <Gift className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              KES 500 Bonus!
            </h3>
            <p className="text-gray-600 text-sm mt-2">
              {isLoggedIn ? 'Referral Achievement Reward' : 'Join & Earn'}
            </p>
          </div>

          {/* Status Content */}
          {!isLoggedIn ? (
            // Non-logged-in users: promotional content
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-purple-100 to-pink-100 rounded-xl p-4">
                <p className="text-sm font-semibold text-gray-800 mb-2">
                  Earn a KES 500 bonus when you join and refer 5 people.
                </p>
                <p className="text-xs text-gray-700 leading-relaxed">
                  Join HustleHub Africa, activate your account, and refer 5 friends to unlock your bonus instantly.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">
                  <CheckCircle className="w-4 h-4 text-purple-600 flex-shrink-0" />
                  <span>No hidden fees or conditions</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">
                  <CheckCircle className="w-4 h-4 text-purple-600 flex-shrink-0" />
                  <span>Automatic bonus when you qualify</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">
                  <CheckCircle className="w-4 h-4 text-purple-600 flex-shrink-0" />
                  <span>Withdraw to M-Pesa anytime</span>
                </div>
              </div>

              <div className="flex gap-2">
                <a
                  href="/auth/sign-up?ref=SANDY001"
                  className="flex-1 py-3 px-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg hover:shadow-xl text-center"
                >
                  Sign Up Now
                </a>
                <button
                  onClick={handleClose}
                  className="flex-1 py-3 px-4 border-2 border-purple-600 text-purple-600 font-semibold rounded-lg hover:bg-purple-50 transition-all"
                >
                  Later
                </button>
              </div>
            </div>
          ) : isLoading ? (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-purple-600 mx-auto mb-3" />
              <p className="text-gray-600 text-sm">Checking your eligibility...</p>
            </div>
          ) : bonusStatus === 'qualified' ? (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-green-900">Congratulations! 🎉</p>
                    <p className="text-sm text-green-700 mt-1">
                      You&apos;ve successfully referred 5 people and activated your account!
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-r from-purple-100 to-pink-100 rounded-xl p-4 text-center">
                <p className="text-sm text-gray-600 mb-1">Bonus Amount</p>
                <p className="text-3xl font-bold text-purple-600">KES 500</p>
                <p className="text-xs text-gray-600 mt-2">Added to your wallet</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <Users className="w-4 h-4 text-purple-600 flex-shrink-0" />
                  <span>You referred: <strong>{referralCount} people</strong></span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                  <span>Account activated: <strong>Yes ✓</strong></span>
                </div>
              </div>

              <button
                onClick={handleClose}
                className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg hover:shadow-xl"
              >
                Awesome! Close
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-sm text-blue-800 mb-3">
                  <strong>How to earn your KES 500 bonus:</strong>
                </p>
                <ul className="space-y-2 text-sm text-blue-700">
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-blue-900 flex-shrink-0">1.</span>
                    <span>Join HustleHub and complete your profile</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-blue-900 flex-shrink-0">2.</span>
                    <span>Activate your account (complete one task or deposit)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-blue-900 flex-shrink-0">3.</span>
                    <span>Refer at least 5 people using your referral link</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-blue-900 flex-shrink-0">✓</span>
                    <span className="font-semibold">Get KES 500 bonus automatically!</span>
                  </li>
                </ul>
              </div>

              <div className="bg-gradient-to-r from-purple-100 to-pink-100 rounded-xl p-4 text-center">
                <p className="text-sm text-gray-600 mb-1">Current Progress</p>
                <p className="text-2xl font-bold text-purple-600">{referralCount}/5</p>
                <p className="text-xs text-gray-600 mt-2">referrals needed</p>
              </div>

              <button
                onClick={handleClose}
                className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg hover:shadow-xl"
              >
                Got it! Keep Earning
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
