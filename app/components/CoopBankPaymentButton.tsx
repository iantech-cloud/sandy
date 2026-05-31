'use client';

import { useState } from 'react';
import { useCoopBankPayment } from '@/app/hooks/useCoopBankPayment';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

interface CoopBankPaymentButtonProps {
  amount: number;
  phoneNumber: string;
  narration?: string;
  onSuccess?: (messageReference: string) => void;
  onError?: (error: string) => void;
  className?: string;
}

export function CoopBankPaymentButton({
  amount,
  phoneNumber,
  narration = 'Payment for services',
  onSuccess,
  onError,
  className = '',
}: CoopBankPaymentButtonProps) {
  const { initiatePayment, isLoading, error } = useCoopBankPayment();
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
      });

      if (result.success && result.messageReference) {
        onSuccess?.(result.messageReference);
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
        disabled={isLoading}
        className={className}
        size="lg"
      >
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {isLoading ? 'Processing...' : `Pay KES ${amount.toLocaleString()}`}
      </Button>
      {displayError && (
        <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
          {displayError}
        </div>
      )}
    </div>
  );
}
