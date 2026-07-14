'use client';

import { useState, useEffect, useRef } from 'react';
import { Loader2, Clock } from 'lucide-react';
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
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [scriptError, setScriptError] = useState(false);
  const handlerRef = useRef<any>(null);
  const config = getHashBackConfig();

  // Load HashPay script on component mount
  useEffect(() => {
    // Skip if not enabled or no account ID
    if (config.status === 'coming_soon' || !config.accountId) {
      console.log('[v0] HashBack not available - status:', config.status, 'account:', !!config.accountId);
      return;
    }

    // Check if script already exists
    if ((window as any).HashPay) {
      console.log('[v0] HashPay script already loaded');
      setScriptLoaded(true);
      return;
    }

    // Check if script tag already exists in DOM
    const existingScript = document.querySelector('script[src="https://pay.hashback.co.ke/hashpay.js"]');
    if (existingScript) {
      console.log('[v0] HashPay script tag exists, waiting for load...');
      let attempts = 0;
      const maxAttempts = 50; // 2.5 seconds max
      
      const checkScript = setInterval(() => {
        attempts++;
        if ((window as any).HashPay) {
          clearInterval(checkScript);
          setScriptLoaded(true);
          console.log('[v0] HashPay script loaded from existing tag');
        } else if (attempts >= maxAttempts) {
          clearInterval(checkScript);
          console.warn('[v0] HashPay script timeout after existing tag');
          setScriptError(true);
        }
      }, 50);
      return () => clearInterval(checkScript);
    }

    // Create and append script tag
    const script = document.createElement('script');
    script.src = 'https://pay.hashback.co.ke/hashpay.js';
    script.async = true;

    let timeout: NodeJS.Timeout;
    const loadTimeout = 10000; // 10 second timeout

    script.onload = () => {
      clearTimeout(timeout);
      console.log('[v0] HashPay script tag loaded from CDN');
      
      // Give the script a moment to initialize the global object
      setTimeout(() => {
        if ((window as any).HashPay) {
          console.log('[v0] HashPay global object initialized');
          setScriptLoaded(true);
        } else {
          console.warn('[v0] HashPay global not initialized after onload event');
          setScriptError(true);
        }
      }, 200);
    };

    script.onerror = (error) => {
      clearTimeout(timeout);
      console.error('[v0] Failed to load HashPay script from CDN:', error);
      setScriptError(true);
    };

    // Set a timeout in case onload/onerror don't fire
    timeout = setTimeout(() => {
      if (!scriptLoaded && !(window as any).HashPay) {
        console.error('[v0] HashPay script load timeout');
        setScriptError(true);
      }
    }, loadTimeout);

    console.log('[v0] Appending HashPay script to document head');
    document.head.appendChild(script);

    return () => {
      clearTimeout(timeout);
      // Cleanup: remove script on unmount
      try {
        if (script.parentElement) {
          script.parentElement.removeChild(script);
          console.log('[v0] HashPay script removed from DOM');
        }
      } catch (err) {
        console.warn('[v0] Error removing HashPay script:', err);
      }
    };
  }, [config.status, config.accountId]);

  if (!config.accountId) {
    console.error('[v0] NEXT_PUBLIC_HASHBACK_ACCOUNT_ID not configured');
    return null;
  }

  const handlePay = async () => {
    if (!scriptLoaded) {
      console.error('[v0] HashPay script not loaded yet');
      onError?.(new Error('Payment system is loading. Please try again.'));
      return;
    }

    if (!(window as any).HashPay) {
      console.error('[v0] HashPay not available on window');
      onError?.(new Error('Payment system failed to initialize'));
      return;
    }

    setLoading(true);

    try {
      console.log('[v0] Setting up HashPay with:', {
        account: config.accountId,
        amount: Math.round(amount),
        reference,
      });

      handlerRef.current = (window as any).HashPay.setup({
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
      if (handlerRef.current?.openIframe) {
        handlerRef.current.openIframe();
      } else {
        console.error('[v0] openIframe method not found on handler');
        throw new Error('Payment handler not properly initialized');
      }
    } catch (err) {
      console.error('[v0] HashBack setup error:', err);
      setLoading(false);
      onError?.(err instanceof Error ? err : new Error('Payment setup failed'));
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
  if (scriptError) {
    return (
      <button
        disabled
        className={`px-4 py-3 bg-red-100 text-red-700 rounded font-medium border border-red-300 flex items-center justify-center gap-2 ${className}`}
      >
        Payment system unavailable
      </button>
    );
  }

  return (
    <button
      onClick={handlePay}
      disabled={loading || !scriptLoaded}
      className={`px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${className}`}
      title={!scriptLoaded ? 'Loading payment system...' : ''}
    >
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          Processing...
        </>
      ) : !scriptLoaded ? (
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
