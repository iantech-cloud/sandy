'use client';

import { useState } from 'react';
import { X, CheckCircle2, AlertCircle, Phone } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { PaymentMethodSelector } from '@/app/components/PaymentMethodSelector';

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DepositModal({ isOpen, onClose }: DepositModalProps) {
  const { data: session } = useSession();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [amount, setAmount] = useState('30');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleDepositSuccess = () => {
    setSuccess(true);
    setTimeout(() => {
      setPhoneNumber('');
      setAmount('30');
      setError('');
      setSuccess(false);
      onClose();
    }, 1500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
      <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl max-w-md w-full p-7 shadow-2xl border border-gray-200">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900">Deposit Funds</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-gray-600 text-sm mb-6">Choose your payment method and enter details</p>

        {success ? (
          <div className="text-center py-6">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <p className="text-gray-700 font-semibold">Deposit initiated successfully!</p>
            <p className="text-gray-600 text-sm mt-2">Confirming payment...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                <p className="text-sm">{error}</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Phone Number</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="07XXXXXXXX"
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  maxLength={12}
                />
              </div>
            </div>

            {phoneNumber && (
              <>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Amount (KES)</label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Minimum KES 30"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="30"
                    step="1"
                  />
                  <p className="text-xs text-gray-600 mt-1">Minimum: KES 30</p>
                </div>

                {amount && parseFloat(amount) >= 30 && (
                  <PaymentMethodSelector
                    amount={parseFloat(amount) || 30}
                    customAmountCents={Math.round(parseFloat(amount) * 100) || 3000}
                    reference={`CHAT_DEPOSIT_${Date.now()}`}
                    phoneNumber={phoneNumber}
                    narration="Chat Wallet Deposit"
                    onSuccess={() => {
                      setError('');
                      handleDepositSuccess();
                    }}
                    onError={(err) => {
                      setError(`Payment failed: ${err.message || 'Please try again'}`);
                    }}
                  />
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
