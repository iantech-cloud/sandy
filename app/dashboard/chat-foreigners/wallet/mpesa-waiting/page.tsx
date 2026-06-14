'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Loader2, CheckCircle, XCircle, Clock, Phone, ArrowLeft } from 'lucide-react';
import { checkMpesaPaymentStatus } from '@/app/actions/deposit';

interface PaymentStatus {
  status: 'processing' | 'success' | 'failed' | 'cancelled' | 'timeout';
  resultCode?: string | number;
  resultDesc?: string;
  mpesaReceiptNumber?: string;
  amount?: number;
  source?: string;
}

export default function ChatWalletMpesaWaitingPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const amount = searchParams.get('amount');
  const phone = searchParams.get('phone');
  
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>({ 
    status: 'processing' 
  });
  const [timeLeft, setTimeLeft] = useState(180);
  const [pollingCount, setPollingCount] = useState(0);
  const [isPolling, setIsPolling] = useState(true);
  const [messageReference, setMessageReference] = useState<string | null>(null);

  // Get messageReference from session storage
  useEffect(() => {
    const ref = sessionStorage.getItem('chatWalletDepositRef');
    if (ref) {
      setMessageReference(ref);
      sessionStorage.removeItem('chatWalletDepositRef');
    }
  }, []);

  // Poll for payment status
  const pollPaymentStatus = useCallback(async () => {
    if (!messageReference || !isPolling) return;

    try {      
      const result = await checkMpesaPaymentStatus(messageReference);
      setPollingCount(prev => prev + 1);

      if (result.success && result.data) {
        const { status, resultCode, resultDesc, mpesaReceiptNumber } = result.data;

        if (status === 'pending' || status === 'initiated') {
          return;
        }

        if (status === 'completed') {
          setPaymentStatus({
            status: 'success',
            resultCode,
            resultDesc,
            mpesaReceiptNumber,
            amount: Number(amount),
          });
          setIsPolling(false);
        } else if (status === 'cancelled') {
          setPaymentStatus({
            status: 'cancelled',
            resultCode,
            resultDesc: resultDesc || 'You cancelled the payment request',
            amount: Number(amount),
          });
          setIsPolling(false);
        } else if (status === 'failed') {
          setPaymentStatus({
            status: 'failed',
            resultCode,
            resultDesc: resultDesc || 'Payment failed',
            amount: Number(amount),
          });
          setIsPolling(false);
        } else if (status === 'timeout') {
          setPaymentStatus({
            status: 'timeout',
            resultCode,
            resultDesc: resultDesc || 'Payment request timed out',
            amount: Number(amount),
          });
          setIsPolling(false);
        }
      }
    } catch (error) {
      console.error('Error polling payment status:', error);
    }
  }, [messageReference, amount, isPolling]);

  // Timer countdown
  useEffect(() => {
    if (timeLeft <= 0) {
      if (paymentStatus.status === 'processing' && isPolling) {
        setPaymentStatus({
          status: 'timeout',
          resultCode: 1037,
          resultDesc: 'Payment request timed out. Please try again.'
        });
        setIsPolling(false);
      }
      return;
    }

    const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
    return () => clearTimeout(timer);
  }, [timeLeft, paymentStatus.status, isPolling]);

  // Polling interval
  useEffect(() => {
    if (!isPolling || paymentStatus.status !== 'processing') return;
    const interval = setInterval(pollPaymentStatus, 4000);
    return () => clearInterval(interval);
  }, [isPolling, paymentStatus.status, pollPaymentStatus]);

  // Initial poll
  useEffect(() => {
    if (messageReference && isPolling) {
      const timer = setTimeout(() => pollPaymentStatus(), 2000);
      return () => clearTimeout(timer);
    }
  }, [messageReference, pollPaymentStatus, isPolling]);

  // Redirect if no amount or phone
  useEffect(() => {
    if (!amount || !phone) {
      router.push('/dashboard/chat-foreigners/wallet');
    }
  }, [amount, phone, router]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!amount || !phone) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className={`max-w-md w-full bg-white rounded-2xl p-8 shadow-lg border-2 ${
        paymentStatus.status === 'success' ? 'border-green-200' :
        paymentStatus.status === 'processing' ? 'border-blue-200' :
        'border-red-200'
      }`}>
        <div className="text-center">
          {paymentStatus.status === 'processing' && <Loader2 className="animate-spin h-12 w-12 text-blue-500 mx-auto" />}
          {paymentStatus.status === 'success' && <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />}
          {(paymentStatus.status === 'failed' || paymentStatus.status === 'cancelled' || paymentStatus.status === 'timeout') && <XCircle className="h-12 w-12 text-red-500 mx-auto" />}
          
          <h1 className={`text-2xl font-bold mt-6 mb-3 ${
            paymentStatus.status === 'success' ? 'text-green-600' :
            paymentStatus.status === 'processing' ? 'text-blue-600' :
            'text-red-600'
          }`}>
            {paymentStatus.status === 'processing' && 'Processing Payment'}
            {paymentStatus.status === 'success' && 'Deposit Successful!'}
            {paymentStatus.status === 'failed' && 'Payment Failed'}
            {paymentStatus.status === 'cancelled' && 'Payment Cancelled'}
            {paymentStatus.status === 'timeout' && 'Payment Timeout'}
          </h1>
          
          <p className="text-gray-700 mb-6">
            {paymentStatus.status === 'processing' && 'Check your phone and enter your M-Pesa PIN to complete the deposit.'}
            {paymentStatus.status === 'success' && `Your deposit of KES ${amount} has been completed successfully.`}
            {paymentStatus.status === 'failed' && paymentStatus.resultDesc}
            {paymentStatus.status === 'cancelled' && 'You cancelled the payment request.'}
            {paymentStatus.status === 'timeout' && 'The payment request timed out. Please try again.'}
          </p>

          {/* Transaction Details */}
          <div className="bg-gray-100 rounded-lg p-4 mb-6 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-left">
                <span className="text-gray-600">Amount:</span>
                <div className="font-semibold">KES {amount}</div>
              </div>
              <div className="text-left">
                <span className="text-gray-600">Phone:</span>
                <div className="font-semibold">{phone}</div>
              </div>
              <div className="text-left">
                <span className="text-gray-600">Time Left:</span>
                <div className={`font-semibold ${timeLeft < 60 ? 'text-red-500' : ''}`}>
                  {formatTime(timeLeft)}
                </div>
              </div>
              <div className="text-left">
                <span className="text-gray-600">Checks:</span>
                <div className="font-semibold">{pollingCount}</div>
              </div>
            </div>
          </div>

          {paymentStatus.status === 'processing' && (
            <div className="bg-blue-100 border border-blue-300 rounded-lg p-4 mb-6 text-sm text-left text-blue-800">
              <div className="font-semibold mb-2 flex items-center gap-2">
                <Phone className="h-4 w-4" />
                What to do:
              </div>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Check your phone for the M-Pesa prompt</li>
                <li>Enter your M-Pesa PIN when prompted</li>
                <li>Wait for automatic confirmation</li>
                <li>Do not close this page</li>
              </ul>
            </div>
          )}

          {paymentStatus.status === 'success' && paymentStatus.mpesaReceiptNumber && (
            <div className="bg-green-100 border border-green-300 rounded-lg p-4 mb-6 text-sm text-green-800">
              <div className="font-semibold mb-1">M-Pesa Receipt:</div>
              <div className="font-mono">{paymentStatus.mpesaReceiptNumber}</div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col space-y-3">
            {paymentStatus.status === 'processing' && (
              <>
                <button
                  onClick={() => {
                    setIsPolling(false);
                    router.push('/dashboard/chat-foreigners/wallet');
                  }}
                  className="py-3 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Cancel & Return
                </button>
              </>
            )}
            
            {(paymentStatus.status === 'success' || paymentStatus.status !== 'processing') && (
              <button
                onClick={() => router.push('/dashboard/chat-foreigners/wallet')}
                className={`py-3 px-4 rounded-lg text-white font-semibold transition-colors ${
                  paymentStatus.status === 'success' ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {paymentStatus.status === 'success' ? 'Go to Chat Wallet' : 'Back to Wallet'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
