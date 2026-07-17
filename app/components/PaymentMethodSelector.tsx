'use client';

import { MpesaPaymentButton } from './MpesaPaymentButton';

interface PaymentMethodSelectorProps {
  amount: number; // KES amount
  reference: string; // Payment reference for tracking
  customAmountCents?: number; // Optional override for dynamic amounts
  onSuccess?: (txn: any, provider: 'mpesa') => void;
  onError?: (error: any, provider: 'mpesa') => void;
  phoneNumber?: string; // For M-Pesa
  narration?: string; // For M-Pesa
  depositType?: 'wallet' | 'activation' | 'gaming' | 'spin_wallet';
}

export function PaymentMethodSelector({
  amount,
  reference,
  customAmountCents,
  onSuccess,
  onError,
  phoneNumber,
  narration,
  depositType = 'wallet',
}: PaymentMethodSelectorProps) {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="mb-4">
        <label className="block font-semibold text-gray-700 mb-2">
          Complete Payment
        </label>
        <p className="text-sm text-gray-600">
          Pay via M-Pesa to complete this transaction
        </p>
      </div>

      {/* Payment Method */}
      <div className="flex flex-col">
        <p className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">
          M-Pesa STK Push
        </p>
        <MpesaPaymentButton
          amount={customAmountCents ? customAmountCents / 100 : amount}
          phoneNumber={phoneNumber || ''}
          narration={narration || `Payment - ${reference}`}
          depositType={depositType}
          onSuccess={(txn) => {
            console.log('[v0] M-Pesa payment initiated:', txn);
            onSuccess?.(txn, 'mpesa');
          }}
          onError={(error) => {
            console.error('[v0] M-Pesa payment error:', error);
            onError?.(error, 'mpesa');
          }}
          className="w-full"
        />
      </div>

      {/* Info Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900">
        <p className="font-semibold mb-2">How it Works</p>
        <ul className="list-disc list-inside space-y-1 text-xs">
          <li>You will receive an STK prompt on your registered phone</li>
          <li>Enter your M-Pesa PIN to complete payment</li>
          <li>Payment is instant and receipt is automatic</li>
          <li>Your account will be updated immediately upon successful payment</li>
        </ul>
      </div>
    </div>
  );
}
