import { useState, useCallback } from 'react';

interface STKPushPayload {
  amount: number;
  phoneNumber: string;
  narration?: string;
  depositType?: 'wallet' | 'spin_wallet' | 'activation' | 'gaming';
}

interface STKPushResponse {
  success: boolean;
  data?: {
    accountReference: string;
    checkoutRequestID: string;
    transactionId: string;
    amount: number;
    phoneNumber: string;
  };
  message?: string;
  error?: string;
}

interface TransactionStatus {
  success: boolean;
  data?: {
    status: 'completed' | 'pending' | 'failed' | 'cancelled' | 'timeout';
    amount: number;
    resultCode?: string;
    resultDesc?: string;
  };
  error?: string;
}

/**
 * Hook for handling Safaricom M-Pesa Daraja payments
 */
export function useMpesaPayment() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [checkoutRequestID, setCheckoutRequestID] = useState<string | null>(null);

  /**
   * Initiate STK push payment via M-Pesa
   */
  const initiatePayment = useCallback(
    async (payload: STKPushPayload) => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/payments/mpesa/stk-push', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to initiate payment');
        }

        const data = (await response.json()) as STKPushResponse;

        if (data.success) {
          setTransactionId(data.data?.transactionId || null);
          setCheckoutRequestID(data.data?.checkoutRequestID || null);

          return {
            success: true,
            transactionId: data.data?.transactionId,
            checkoutRequestID: data.data?.checkoutRequestID,
            accountReference: data.data?.accountReference,
            message: data.message,
          };
        } else {
          throw new Error(data.error || 'Payment initiation failed');
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An error occurred';
        setError(errorMessage);

        return {
          success: false,
          error: errorMessage,
        };
      } finally {
        setLoading(false);
      }
    },
    []
  );

  /**
   * Check transaction status via M-Pesa API
   */
  const checkStatus = useCallback(async (checkoutReqID: string): Promise<TransactionStatus> => {
    try {
      const response = await fetch('/api/payments/mpesa/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ checkoutRequestID: checkoutReqID }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to check status');
      }

      return await response.json();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';

      return {
        success: false,
        error: errorMessage,
      };
    }
  }, []);

  /**
   * Poll transaction status with optimized delays
   * M-Pesa callbacks typically arrive within 5-10 seconds
   */
  const pollTransactionStatus = useCallback(
    async (checkoutReqID: string, maxAttempts = 30, initialDelayMs = 500): Promise<TransactionStatus | null> => {
      let delayMs = initialDelayMs;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        // Check immediately on first attempt, then wait
        if (attempt > 1) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }

        console.log(`[M-Pesa Poll] Attempt ${attempt}/${maxAttempts} - checking status`);

        const status = await checkStatus(checkoutReqID);

        if (status.success && status.data) {
          const { status: paymentStatus } = status.data;

          // Terminal state reached
          if (['completed', 'failed', 'cancelled', 'timeout'].includes(paymentStatus)) {
            console.log(`[M-Pesa Poll] Transaction ${paymentStatus}`);
            return status;
          }
        }

        // Smart backoff: Start fast (500ms), increase gradually, cap at 3s
        delayMs = Math.min(delayMs * 1.3, 3000);
      }

      console.warn(`[M-Pesa Poll] Max attempts reached`);
      return null;
    },
    [checkStatus]
  );

  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
    setTransactionId(null);
    setCheckoutRequestID(null);
  }, []);

  return {
    loading,
    error,
    transactionId,
    checkoutRequestID,
    initiatePayment,
    checkStatus,
    pollTransactionStatus,
    reset,
  };
}
