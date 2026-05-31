'use client';

import { useState } from 'react';
import { CoopBankPaymentButton } from '@/app/components/CoopBankPaymentButton';

export default function CoopBankPaymentDemo() {
  const [amount, setAmount] = useState<number>(100);
  const [phoneNumber, setPhoneNumber] = useState<string>('254707919065');
  const [narration, setNarration] = useState<string>('Payment for services');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSuccess = (messageReference: string) => {
    setSuccessMessage(`Payment initiated successfully! Reference: ${messageReference}`);
    setErrorMessage(null);
    setTimeout(() => setSuccessMessage(null), 5000);
  };

  const handleError = (error: string) => {
    setErrorMessage(error);
    setSuccessMessage(null);
  };

  return (
    <main className="min-h-screen bg-slate-900 p-8">
      <div className="max-w-md mx-auto">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-6">
          <div>
            <h1 className="text-xl font-semibold text-white">Co-operative Bank STK Push</h1>
            <p className="text-sm text-slate-400 mt-1">Test the STK push payment integration</p>
          </div>

          {/* Amount */}
          <div className="space-y-1">
            <label htmlFor="amount" className="block text-sm font-medium text-slate-300">
              Amount (KES)
            </label>
            <input
              id="amount"
              type="number"
              min="1"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              placeholder="Enter amount"
              className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-slate-500">Minimum: KES 1</p>
          </div>

          {/* Phone */}
          <div className="space-y-1">
            <label htmlFor="phone" className="block text-sm font-medium text-slate-300">
              Phone Number
            </label>
            <input
              id="phone"
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="254707919065"
              className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-slate-500">Format: 254XXXXXXXXX</p>
          </div>

          {/* Narration */}
          <div className="space-y-1">
            <label htmlFor="narration" className="block text-sm font-medium text-slate-300">
              Description
            </label>
            <input
              id="narration"
              type="text"
              value={narration}
              onChange={(e) => setNarration(e.target.value)}
              placeholder="Payment description"
              className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Status Messages */}
          {successMessage && (
            <div className="p-3 bg-green-900 border border-green-700 rounded-lg text-green-100 text-sm">
              {successMessage}
            </div>
          )}
          {errorMessage && (
            <div className="p-3 bg-red-900 border border-red-700 rounded-lg text-red-100 text-sm">
              {errorMessage}
            </div>
          )}

          {/* Payment Button */}
          <CoopBankPaymentButton
            amount={amount}
            phoneNumber={phoneNumber}
            narration={narration}
            onSuccess={handleSuccess}
            onError={handleError}
            className="w-full justify-center bg-blue-600 hover:bg-blue-700"
          />

          {/* How it works */}
          <div className="p-3 bg-slate-700 rounded-lg text-xs text-slate-300 space-y-1">
            <p className="font-semibold text-slate-100">How it works:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Enter amount and phone number</li>
              <li>Click &quot;Pay KES X&quot; to initiate</li>
              <li>Customer receives STK push prompt on phone</li>
              <li>Customer enters Co-op Bank PIN to confirm</li>
              <li>Callback confirms the transaction status</li>
            </ul>
          </div>
        </div>
      </div>
    </main>
  );
}
