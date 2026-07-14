'use client';

import { HashBackPaymentButton } from './HashBackPaymentButton';
import { CoopBankPaymentButton } from './CoopBankPaymentButton';

interface PaymentMethodSelectorProps {
  amount: number; // KES amount
  reference: string; // Payment reference for tracking
  customAmountCents?: number; // Optional override for dynamic amounts
  onSuccess?: (txn: any, provider: 'coop_bank' | 'hashback') => void;
  onError?: (error: any, provider: 'coop_bank' | 'hashback') => void;
  phoneNumber?: string; // For Co-op Bank
  narration?: string; // For Co-op Bank
}

export function PaymentMethodSelector({
  amount,
  reference,
  customAmountCents,
  onSuccess,
  onError,
  phoneNumber,
  narration,
}: PaymentMethodSelectorProps) {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="mb-4">
        <label className="block font-semibold text-gray-700 mb-2">
          Choose Payment Method
        </label>
        <p className="text-sm text-gray-600">
          Select your preferred payment method to complete this transaction
        </p>
      </div>

      {/* Payment Methods Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Co-op Bank Option */}
        <div className="flex flex-col">
          <p className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">
            Co-op Bank (M-Pesa STK)
          </p>
          <CoopBankPaymentButton
            amount={customAmountCents ? customAmountCents / 100 : amount}
            phoneNumber={phoneNumber || ''}
            narration={narration || `Payment - ${reference}`}
            onSuccess={(msgRef) => {
              console.log('[v0] Co-op Bank payment initiated:', msgRef);
              onSuccess?.(
                { messageReference: msgRef, reference },
                'coop_bank'
              );
            }}
            onError={(error) => {
              console.error('[v0] Co-op Bank payment error:', error);
              onError?.(error, 'coop_bank');
            }}
            className="w-full"
          />
        </div>

        {/* HashBack Option */}
        <div className="flex flex-col">
          <p className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">
            HashBack (M-Pesa STK)
          </p>
          <HashBackPaymentButton
            amount={customAmountCents ? customAmountCents / 100 : amount}
            reference={reference}
            label="Pay with HashBack"
            onSuccess={(txn) => {
              console.log('[v0] HashBack payment success:', txn);
              onSuccess?.(txn, 'hashback');
            }}
            onError={(error) => {
              console.error('[v0] HashBack payment error:', error);
              onError?.(error, 'hashback');
            }}
            onCancel={() => {
              console.log('[v0] HashBack payment cancelled');
            }}
            className="w-full"
          />
        </div>
      </div>

      {/* Info Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900">
        <p className="font-semibold mb-2">Payment Information</p>
        <ul className="list-disc list-inside space-y-1 text-xs">
          <li>Both methods use M-Pesa for secure payment</li>
          <li>You will receive an STK prompt on your registered phone</li>
          <li>Enter your M-Pesa PIN to complete payment</li>
          <li>Payment is instant and receipt is automatic</li>
        </ul>
      </div>
    </div>
  );
}
