'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, Loader, CheckCircle2, AlertCircle } from 'lucide-react';
import { useSession } from 'next-auth/react';

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DepositModal({ isOpen, onClose }: DepositModalProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const [amount, setAmount] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const amountCents = Math.round(parseFloat(amount) * 100);

      if (!phoneNumber || !amountCents || amountCents < 10000) {
        setError('Please enter a valid phone number and amount (minimum KES 100)');
        setLoading(false);
        return;
      }

      const res = await fetch('/api/chat-foreigners/wallet/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountCents,
          phoneNumber,
        }),
      });

      const data = await res.json();

      if (data.success) {
        // Store messageReference in sessionStorage for the waiting page to retrieve
        if (data.messageReference) {
          sessionStorage.setItem('chatWalletDepositRef', data.messageReference);
        }
        
        setSuccess(true);
        // Redirect to M-Pesa waiting page to poll for payment completion
        setTimeout(() => {
          const params = new URLSearchParams({
            amount: amount,
            phone: phoneNumber,
            type: 'chat_wallet_deposit',
          });
          router.push(`/dashboard/chat-foreigners/wallet/mpesa-waiting?${params.toString()}`);
        }, 1500);
      } else {
        setError(data.error || 'Failed to initiate deposit');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
      <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl max-w-md w-full p-7 shadow-2xl border border-gray-200">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Deposit to Chat Wallet</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition p-1 rounded-lg hover:bg-gray-100"
          >
            <X size={24} />
          </button>
        </div>

        {success ? (
          <div className="text-center py-10">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
            </div>
            <p className="text-green-600 font-semibold text-lg mb-2">Deposit initiated!</p>
            <p className="text-gray-600">Check your phone for the M-Pesa prompt.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-start gap-2">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-2">
                Amount (KES)
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter amount"
                min="100"
                step="1"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900 placeholder-gray-500 bg-white"
              />
              <p className="text-xs text-gray-600 mt-1.5">Minimum: KES 100</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-2">
                M-Pesa Phone Number
              </label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="254712345678"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900 placeholder-gray-500 bg-white"
              />
              <p className="text-xs text-gray-600 mt-1.5">Format: 254712345678 (with country code)</p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white py-2.5 rounded-lg hover:from-green-600 hover:to-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-semibold flex items-center justify-center gap-2 shadow-lg"
            >
              {loading && <Loader size={20} className="animate-spin" />}
              {loading ? 'Processing...' : 'Deposit Now'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
