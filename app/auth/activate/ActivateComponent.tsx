'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Phone, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { checkActivationStatus, initiateActivationPayment } from '@/app/actions/activation';
import Link from 'next/link';

export default function ActivateComponent() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('error');
  const [activationStatus, setActivationStatus] = useState<any>(null);
  
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const paymentStatus = searchParams.get('paymentStatus');
    const error = searchParams.get('error');
    
    if (paymentStatus === 'failed' || error) {
      setMessageType('error');
      setMessage(error || 'Payment was not completed. Please try again.');
    }
    
    if (paymentStatus === 'cancelled') {
      setMessageType('info');
      setMessage('Payment was cancelled. You can try again when ready.');
    }
  }, [searchParams]);

  useEffect(() => {
    async function checkStatus() {
      try {
        const result = await checkActivationStatus();
        if (result.success) {
          setActivationStatus(result.data);
          
          if (result.data.activation_paid) {
            router.push('/dashboard');
          }
        } else {
          setMessageType('error');
          setMessage(result.message || 'Failed to check status');
        }
      } catch (error) {
        console.error('Error checking status:', error);
        setMessageType('error');
        setMessage('Failed to check status');
      }
    }

    checkStatus();
  }, [router]);

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const result = await initiateActivationPayment(phoneNumber);

      if (result.success && result.data?.messageReference) {
        const params = new URLSearchParams({
          messageReference: result.data.messageReference,
          amount: (result.data.amount / 100).toString(),
          phoneNumber: result.data.phoneNumber,
          activation: 'true',
          activationPaymentId: result.data.activationPaymentId
        });
        
        router.push(`/auth/activate/mpesa-waiting?${params.toString()}`);
        
      } else {
        setMessageType('error');
        setMessage(result.message || 'Payment could not be initiated. Please try again.');
      }
    } catch (error) {
      console.error('Payment error:', error);
      setMessageType('error');
      setMessage('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    
    if (value.startsWith('0') && value.length <= 10) {
      value = value;
    } else if (value.startsWith('254') && value.length <= 12) {
      value = value;
    } else if (value.length > 0 && !value.startsWith('0') && !value.startsWith('254')) {
      value = '0' + value;
    }
    
    setPhoneNumber(value);
  };

  const formatPhoneForDisplay = (phone: string): string => {
    if (phone.startsWith('254') && phone.length === 12) {
      return `0${phone.substring(3)}`;
    }
    return phone;
  };

  const isValidPhone = (phone: string): boolean => {
    const cleanPhone = phone.replace(/\s/g, '');
    if (cleanPhone.startsWith('0') && cleanPhone.length === 10) return true;
    if (cleanPhone.startsWith('254') && cleanPhone.length === 12) return true;
    return false;
  };

  if (!activationStatus) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-sm p-8 w-full max-w-md text-center border border-gray-200">
          <Loader2 className="animate-spin w-8 h-8 mx-auto text-indigo-600" />
          <p className="text-gray-600 mt-4">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-sm p-8 w-full max-w-md border border-gray-200">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Complete Registration</h1>
          <p className="text-gray-600">Pay the registration fee to access the platform</p>
        </div>

        {message && (
          <div className={`p-4 rounded-lg mb-6 flex items-start space-x-3 ${
            messageType === 'success' 
              ? 'bg-green-50 text-green-700 border border-green-200' 
              : messageType === 'error'
              ? 'bg-red-50 text-red-700 border border-red-200'
              : 'bg-blue-50 text-blue-700 border border-blue-200'
          }`}>
            {messageType === 'success' && <CheckCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />}
            {messageType === 'error' && <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />}
            <span className="flex-1">{message}</span>
          </div>
        )}

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
          <p className="text-gray-700 font-semibold mb-3">Activation Fee: <span className="text-indigo-600">KES 95</span></p>
          <p className="text-gray-600 text-sm mb-3">
            This one-time fee activates your account and gives you full access to all earning features on the platform.
          </p>
          <p className="text-gray-700 text-sm font-medium mb-2">Ways to earn after activation:</p>
          <ul className="text-gray-600 text-sm space-y-1 list-none">
            <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-indigo-500 flex-shrink-0"></span>Freelance tasks &amp; writing projects</li>
            <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-indigo-500 flex-shrink-0"></span>Research surveys</li>
            <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-indigo-500 flex-shrink-0"></span>Chat with foreigners</li>
            <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-indigo-500 flex-shrink-0"></span>Referral commissions</li>
            <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-indigo-500 flex-shrink-0"></span>Sales &amp; marketing</li>
          </ul>
        </div>

        <form onSubmit={handlePayment}>
          <div className="mb-6">
            <label className="block font-medium mb-2 text-gray-700">
              Phone Number (Co-op Bank M-Pesa)
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="tel"
                value={phoneNumber}
                onChange={handlePhoneChange}
                placeholder="07XXXXXXXX or 2547XXXXXXXX"
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
                maxLength={12}
              />
            </div>
            {phoneNumber && (
              <p className="text-sm text-gray-500 mt-1">
                {formatPhoneForDisplay(phoneNumber)}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !isValidPhone(phoneNumber)}
            className="w-full py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition duration-150 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin w-5 h-5 mr-2" />
                Processing...
              </>
            ) : (
              'Pay KES 95 via Co-op Bank'
            )}
          </button>
        </form>

        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
          <h4 className="font-semibold text-blue-800 mb-2">Payment Process:</h4>
          <ol className="text-sm text-blue-700 list-decimal list-inside space-y-1">
            <li>Enter your M-Pesa registered phone number</li>
            <li>Click the pay button above</li>
            <li>You will receive a Co-op Bank STK push on your phone</li>
            <li>Enter your M-Pesa PIN to complete the payment</li>
            <li>Your account will be activated after successful payment</li>
          </ol>
        </div>

        <div className="mt-6 text-center">
          <Link href="/" className="text-indigo-600 hover:text-indigo-700 text-sm">
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
