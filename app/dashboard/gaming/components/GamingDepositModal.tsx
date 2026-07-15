'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { X, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { initiateGameingDeposit } from '@/app/actions/gaming';

interface GamingDepositModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function GamingDepositModal({ onClose, onSuccess }: GamingDepositModalProps) {
  const { data: session } = useSession();
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [messageRef, setMessageRef] = useState<string | null>(null);

  const presetAmounts = [100, 500, 1000, 2000, 5000, 10000];

  const handleAmountChange = (value: string) => {
    const numValue = parseInt(value) || 0;
    if (numValue >= 0) {
      setAmount(value);
      setError(null);
    }
  };

  const handleDeposit = async () => {
    setError(null);
    setSuccess(false);

    const numAmount = parseInt(amount);

    if (!amount || numAmount <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (numAmount < 10) {
      setError('Minimum deposit is KES 10');
      return;
    }

    if (numAmount > 1000000) {
      setError('Maximum deposit is KES 1,000,000');
      return;
    }

    try {
      setLoading(true);
      const result = await initiateGameingDeposit(numAmount * 100); // Convert to cents

      if (result.success && result.data?.messageReference) {
        setMessageRef(result.data.messageReference);
        setSuccess(true);
        // Auto-close after 2 seconds
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 2000);
      } else {
        setError(result.message || 'Failed to initiate deposit');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-green-500/30 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-green-500/20 border border-green-500/50 rounded-full flex items-center justify-center">
              <CheckCircle className="text-green-400" size={40} />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Deposit Initiated!</h2>
          <p className="text-gray-400 mb-4">
            STK push has been sent to your phone. Complete the payment to add funds to your gaming wallet.
          </p>
          <p className="text-sm text-purple-400 font-mono mb-6 bg-purple-500/10 border border-purple-500/20 rounded p-3">
            Ref: {messageRef}
          </p>
          <p className="text-gray-500 text-sm">Redirecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-4">
      <div className="bg-slate-900 border border-purple-500/30 rounded-t-3xl md:rounded-3xl w-full md:max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-purple-500/20">
          <h2 className="text-2xl font-bold text-white">Deposit to Gaming</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="text-red-400 flex-shrink-0 mt-0.5" size={18} />
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          {/* Amount Input */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-3">
              Enter Amount (KES)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-3 text-gray-500 text-lg">KES</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => handleAmountChange(e.target.value)}
                placeholder="0"
                className="w-full pl-16 pr-4 py-3 bg-slate-800 border border-purple-500/30 rounded-lg text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none font-bold text-lg"
                disabled={loading}
              />
            </div>
            <p className="text-xs text-gray-400 mt-2">Minimum: KES 10 | Maximum: KES 1,000,000</p>
          </div>

          {/* Preset Amounts */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-3">
              Quick Select
            </label>
            <div className="grid grid-cols-3 gap-2">
              {presetAmounts.map((preset) => (
                <button
                  key={preset}
                  onClick={() => setAmount(preset.toString())}
                  className={`py-2 px-3 rounded-lg font-semibold text-sm transition-all ${
                    amount === preset.toString()
                      ? 'bg-purple-600 text-white border border-purple-400'
                      : 'bg-slate-800 text-gray-300 border border-purple-500/20 hover:border-purple-500/50'
                  }`}
                  disabled={loading}
                >
                  {preset === 1000 ? `${preset / 1000}K` : preset >= 10000 ? `${preset / 1000}K` : preset}
                </button>
              ))}
            </div>
          </div>

          {/* Payment Method Info */}
          <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4">
            <p className="text-sm text-purple-300">
              <span className="font-semibold">Payment Method:</span> Co-op Bank STK Push
            </p>
            <p className="text-xs text-gray-400 mt-2">
              You will receive an STK prompt on your phone. Enter your M-Pesa PIN to complete the deposit.
            </p>
          </div>

          {/* Deposit Button */}
          <button
            onClick={handleDeposit}
            disabled={loading || !amount}
            className={`w-full py-3 px-4 rounded-lg font-bold flex items-center justify-center gap-2 transition-all ${
              loading || !amount
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white hover:shadow-lg hover:shadow-purple-500/50'
            }`}
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Processing...
              </>
            ) : (
              'Deposit Now'
            )}
          </button>

          {/* Close Button (Mobile) */}
          <button
            onClick={onClose}
            className="w-full md:hidden py-2 px-4 text-gray-400 hover:text-gray-300 transition-colors font-medium"
            disabled={loading}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
