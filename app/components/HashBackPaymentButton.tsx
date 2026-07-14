'use client';

import { useState, useEffect } from 'react';
import { Loader2, AlertCircle, Clock } from 'lucide-react';
import { getHashBackConfig } from '@/app/lib/utils/payment-config';

interface HashBackPaymentButtonProps {
  amount: number; // KES amount
  reference: string; // Payment reference
  label?: string;
  onSuccess?: (txn: any) => void;
  onCancel?: () => void;
  onError?: (error: any) => void;
  className?: string;
}

export function HashBackPaymentButton({
  amount,
  reference,
  label = 'Pay with HashBack',
  onSuccess,
  onCancel,
  onError,
  className = '',
}: HashBackPaymentButtonProps) {
  const [loading, setLoading] = useState(false);
  const [hashPayReady, setHashPayReady] = useState(false);
  const config = getHashBackConfig();

  // Wait for HashPay script to load
  useEffect(() => {
    const checkHashPay = () => {
      if ((window as any).HashPay) {
        setHashPayReady(true);
        console.log('[v0] HashPay script loaded');
      } else {
        setTimeout(checkHashPay, 100);
      }
    };

    if (config.isEnabled) {
      checkHashPay();
    }
  }, [config.isEnabled]);

  if (!config.accountId) {
    console.error('[v0] NEXT_PUBLIC_HASHBACK_ACCOUNT_ID not configured');
    return null;
  }

  const handlePay = () => {
    if (!config.isEnabled) {
      return;
    }

    if (!hashPayReady) {
      console.error('[v0] HashPay not yet available');
      onError?.(new Error('Payment system loading. Please try again.'));
      return;
    }

    if (!(window as any).HashPay) {
      console.error('[v0] HashPay not available');
      onError?.(new Error('Payment system failed to load'));
      return;
    }

    setLoading(true);

    try {
      const handler = (window as any).HashPay.setup({
        account: config.accountId,
        amount: Math.round(amount),
        reference: reference,
        onSuccess: async (txn: any) => {
          console.log('[v0] HashBack payment success:', txn);
          
          // Verify payment on server before fulfilling
          try {
            const verifyRes = await fetch('/api/webhooks/hashback/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                reference: txn.reference,
                amount: txn.amount,
                receipt: txn.receipt,
                checkoutId: txn.checkoutid,
              }),
            });

            const verifyData = await verifyRes.json();

            if (verifyRes.ok && verifyData.success) {
              console.log('[v0] HashBack payment verified');
              onSuccess?.(txn);
            } else {
              console.error('[v0] HashBack verification failed:', verifyData);
              onError?.(new Error('Payment verification failed'));
            }
          } catch (err) {
            console.error('[v0] HashBack verification error:', err);
            onError?.(err);
          } finally {
            setLoading(false);
          }
        },
        onCancel: () => {
          console.log('[v0] HashBack payment cancelled by user');
          setLoading(false);
          onCancel?.();
        },
        onError: (error: any) => {
          console.error('[v0] HashBack payment error:', error);
          setLoading(false);
          onError?.(error);
        },
      });

      // Open payment modal
      handler.openIframe?.();
    } catch (err) {
      console.error('[v0] HashBack setup error:', err);
      setLoading(false);
      onError?.(err);
    }
  };

  // Coming Soon badge in production
  if (config.status === 'coming_soon') {
    return (
      <button
        disabled
        className={`relative px-4 py-3 bg-gradient-to-r from-amber-50 to-orange-50 text-amber-900 rounded border-2 border-amber-200 font-medium transition-colors disabled:cursor-not-allowed flex items-center justify-center gap-2 ${className}`}
        title="This payment method will be available soon"
      >
        <Clock className="w-4 h-4" />
        <span>{label}</span>
        <span className="ml-2 inline-block bg-amber-200 text-amber-900 text-xs font-bold px-2 py-1 rounded">
          Coming Soon
        </span>
      </button>
    );
  }

  // Development - Functional button
  return (
    <button
      onClick={handlePay}
      disabled={loading || !hashPayReady}
      className={`px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${className}`}
      title={!hashPayReady ? 'Loading payment system...' : ''}
    >
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          Processing...
        </>
      ) : !hashPayReady ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading...
        </>
      ) : (
        label
      )}
    </button>
  );
}
