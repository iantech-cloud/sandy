import { useState, useCallback } from 'react';

interface STKPushPayload {
  amount: number;
  phoneNumber: string;
  narration?: string;
  depositType?: 'wallet' | 'spin_wallet' | 'activation';
}

interface STKPushResponse {
  success: boolean;
  data?: {
    messageReference: string;
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
    messageReference: string;
    status: 'completed' | 'pending' | 'failed' | 'cancelled' | 'timeout';
    amount: number;
    cached: boolean;
    lastCheckedAt: string;
  };
  error?: string;
}

/**
 * Hook for handling Co-operative Bank M-Pesa payments
 */
export function useCoopBankPayment() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [messageReference, setMessageReference] = useState<string | null>(null);

  /**
   * Initiate STK push payment
   */
  const initiatePayment = useCallback(
    async (payload: STKPushPayload) => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/payments/coop-bank/stk-push', {
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
          setMessageReference(data.data?.messageReference || null);

          return {
            success: true,
            transactionId: data.data?.transactionId,
            messageReference: data.data?.messageReference,
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
   * Check transaction status
   */
  const checkStatus = useCallback(async (msgRef: string): Promise<TransactionStatus> => {
    try {
      const response = await fetch(`/api/payments/coop-bank/status?messageReference=${encodeURIComponent(msgRef)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
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
   * Poll transaction status with optimized delays for fast response
   * Most callbacks arrive within 5-10 seconds, so we check aggressively at first
   */
  const pollTransactionStatus = useCallback(
    async (msgRef: string, maxAttempts = 30, initialDelayMs = 500): Promise<TransactionStatus | null> => {
      let delayMs = initialDelayMs;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        // Check immediately on first attempt, then wait
        if (attempt > 1) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }

        console.log(`[Payment Poll] Attempt ${attempt}/${maxAttempts} - checking status for ${msgRef}`);

        const status = await checkStatus(msgRef);

        if (status.success && status.data) {
          const { status: paymentStatus } = status.data;

          // Terminal state reached
          if (['completed', 'failed', 'cancelled', 'timeout'].includes(paymentStatus)) {
            console.log(`[Payment Poll] Transaction ${paymentStatus}: ${msgRef}`);
            return status;
          }
        }

        // Smart backoff: Start fast (500ms), increase gradually, cap at 3s (most callbacks arrive within 10s)
        delayMs = Math.min(delayMs * 1.3, 3000);
      }

      // Max attempts reached, return last known status
      console.warn(`[Payment Poll] Max attempts reached for ${msgRef}`);
      return null;
    },
    [checkStatus]
  );

  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
    setTransactionId(null);
    setMessageReference(null);
  }, []);

  return {
    loading,
    error,
    transactionId,
    messageReference,
    initiatePayment,
    checkStatus,
    pollTransactionStatus,
    reset,
  };
}
