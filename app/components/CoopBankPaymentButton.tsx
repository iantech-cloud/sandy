'use client';

import { useState } from 'react';
import { useCoopBankPayment } from '@/app/hooks/useCoopBankPayment';
import { Button } from '@/app/ui/button';
import { Loader2, AlertCircle } from 'lucide-react';
import { PAYMENT_ERROR } from '@/app/lib/payment-error';

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
  const { initiatePayment, loading, error } = useCoopBankPayment();
  const [localError, setLocalError] = useState<string | null>(null);

  const handlePayment = async () => {
    // Temporarily block all payments
    setLocalError(PAYMENT_ERROR.title);
    onError?.(PAYMENT_ERROR.title);
    return;
  };

  const displayError = error || localError;

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-red-50 border-2 border-red-500 rounded-lg p-4 flex items-start gap-3">
        <AlertCircle className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h4 className="font-bold text-red-700 text-base">{PAYMENT_ERROR.title}</h4>
          <p className="text-red-600 text-sm mt-1">{PAYMENT_ERROR.message}</p>
        </div>
      </div>
      <Button
        onClick={handlePayment}
        disabled={true}
        className={`${className} bg-gray-300 text-gray-500 cursor-not-allowed hover:bg-gray-300`}
      >
        Pay KES {amount.toLocaleString()}
      </Button>
    </div>
  );
}
