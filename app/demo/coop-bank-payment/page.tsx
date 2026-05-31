'use client';

import { useState } from 'react';
import { CoopBankPaymentButton } from '@/app/components/CoopBankPaymentButton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
    <main className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-8">
      <div className="max-w-md mx-auto">
        <Card className="border-slate-700">
          <CardHeader>
            <CardTitle>Co-operative Bank M-Pesa Payment</CardTitle>
            <CardDescription>
              Test the STK push payment integration
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Amount Input */}
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (KES)</Label>
              <Input
                id="amount"
                type="number"
                min="1"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                placeholder="Enter amount"
                className="bg-slate-800 border-slate-600 text-white"
              />
              <p className="text-xs text-slate-400">Minimum amount: 1 KES</p>
            </div>

            {/* Phone Number Input */}
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="254707919065"
                className="bg-slate-800 border-slate-600 text-white"
              />
              <p className="text-xs text-slate-400">Format: 254XXXXXXXXX</p>
            </div>

            {/* Narration Input */}
            <div className="space-y-2">
              <Label htmlFor="narration">Description</Label>
              <Input
                id="narration"
                type="text"
                value={narration}
                onChange={(e) => setNarration(e.target.value)}
                placeholder="Payment description"
                className="bg-slate-800 border-slate-600 text-white"
              />
            </div>

            {/* Status Messages */}
            {successMessage && (
              <div className="p-3 bg-green-900 border border-green-700 rounded text-green-100 text-sm">
                ✓ {successMessage}
              </div>
            )}
            {errorMessage && (
              <div className="p-3 bg-red-900 border border-red-700 rounded text-red-100 text-sm">
                ✗ {errorMessage}
              </div>
            )}

            {/* Payment Button */}
            <CoopBankPaymentButton
              amount={amount}
              phoneNumber={phoneNumber}
              narration={narration}
              onSuccess={handleSuccess}
              onError={handleError}
              className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
            />

            {/* Info Section */}
            <div className="p-3 bg-slate-800 rounded text-xs text-slate-300 space-y-2">
              <p className="font-semibold text-slate-100">How it works:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Enter the amount and phone number</li>
                <li>Click "Pay KES X" to initiate payment</li>
                <li>Customer receives M-Pesa STK prompt</li>
                <li>Customer enters M-Pesa PIN to complete</li>
                <li>Callback confirms transaction status</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
