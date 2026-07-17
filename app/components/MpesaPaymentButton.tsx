'use client';

import { useState } from 'react';
import { useMpesaPayment } from '@/app/hooks/useMpesaPayment';
import { Button } from '@/app/ui/button';
import { Loader2 } from 'lucide-react';

interface MpesaPaymentButtonProps {
  amount: number;
  phoneNumber: string;
  narration?: string;
  depositType?: 'wallet' | 'activation' | 'gaming' | 'spin_wallet';
  onSuccess?: (txn: any) => void;
  onError?: (error: string) => void;
  className?: string;
}

export function MpesaPaymentButton({
  amount,
  phoneNumber,
  narration = 'Payment to HustleHub Africa',
  depositType = 'wallet',
  onSuccess,
  onError,
  className = '',
}: MpesaPaymentButtonProps) {
  const { initiatePayment, loading, error } = useMpesaPayment();
  const [localError, setLocalError] = useState<string | null>(null);

  const handlePayment = async () => {
    setLocalError(null);

    // Validate inputs
    if (!amount || amount <= 0) {
      const errMsg = 'Amount must be greater than 0';
      setLocalError(errMsg);
      onError?.(errMsg);
      return;
    }

    if (!phoneNumber || !/^254\d{9}$/.test(phoneNumber)) {
      const errMsg = 'Phone number must be in format 254XXXXXXXXX';
      setLocalError(errMsg);
      onError?.(errMsg);
      return;
    }

    try {
      const result = await initiatePayment({
        amount: Math.round(amount),
        phoneNumber,
        narration,
        depositType,
      });

      if (result.success) {
        onSuccess?.(result);
      } else {
        const errMsg = result.error || 'Payment initiation failed';
        setLocalError(errMsg);
        onError?.(errMsg);
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'An error occurred';
      setLocalError(errMsg);
      onError?.(errMsg);
    }
  };

  const displayError = error || localError;

  return (
    <div className="flex flex-col gap-2">
      <Button
        onClick={handlePayment}
        disabled={loading}
        className={className}
      >
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {loading ? 'Processing...' : `Pay KES ${amount.toLocaleString()}`}
      </Button>
      {displayError && (
        <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
          {displayError}
        </div>
      )}
    </div>
  );
}
