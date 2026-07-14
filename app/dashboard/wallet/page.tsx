// app/dashboard/wallet/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DollarSign, Phone, Loader2, CheckCircle, AlertCircle, RefreshCw, Send } from 'lucide-react';
import Alert from '@/app/ui/Alert';
import { useDashboard } from '../../dashboard/DashboardContext';
import { processWithdrawal } from '@/app/actions/transactions';
import { getUserBalance } from '@/app/actions/deposit';
import { formatPhoneNumber, getMpesaPhoneFormat } from '@/app/lib/utils/phoneFormatter';
import { PaymentMethodSelector } from '@/app/components/PaymentMethodSelector';
import { getActivationAmount } from '@/app/lib/utils/dynamic-payment';

const MIN_WITHDRAWAL = 200;

// Band-based processing fee calculation (matches backend in transactions.ts)
function calculateProcessingFee(amount: number): number {
  if (amount >= 200 && amount <= 1000) return 10;
  if (amount > 1000 && amount <= 2000) return 20;
  if (amount > 2000 && amount <= 5000) return 30;
  if (amount > 5000 && amount <= 10000) return 50;
  if (amount > 10000) return 100;
  return 0;
}

// Get fee band description
function getFeeBandDescription(amount: number): string {
  if (amount >= 200 && amount <= 1000) return 'KSh 200 - 1,000';
  if (amount > 1000 && amount <= 2000) return 'KSh 1,001 - 2,000';
  if (amount > 2000 && amount <= 5000) return 'KSh 2,001 - 5,000';
  if (amount > 5000 && amount <= 10000) return 'KSh 5,001 - 10,000';
  if (amount > 10000) return 'Above KSh 10,000';
  return '';
}

// Helper: format phone for display (0XXXXXXXXX)
function formatPhoneForDisplay(phone: string): string {
  if (!phone) return '';
  try {
    const formatted = formatPhoneNumber(phone);
    if (formatted.startsWith('+254')) return `0${formatted.substring(4)}`;
    return formatted;
  } catch {
    return phone;
  }
}

export default function WalletPage() {
  const { user } = useDashboard();
  const router = useRouter();

  const [currentBalance, setCurrentBalance] = useState(0);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [isProcessingWithdraw, setIsProcessingWithdraw] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('success');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [depositPhoneNumber, setDepositPhoneNumber] = useState('');
  const [depositAmountCents, setDepositAmountCents] = useState(3000); // 30 KES default
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info');
  const [currentBalance, setCurrentBalance] = useState(user?.balance || 0);

  if (!user) {
    return (
      <div className="p-8 text-center text-red-500 font-medium">
        User data is unavailable. Please refresh or check your data source.
      </div>
    );
  }

  // Computed fee preview using band-based system
  const withdrawAmountNum = parseFloat(withdrawAmount) || 0;
  const processingFee = calculateProcessingFee(withdrawAmountNum);
  const totalDeduction = withdrawAmountNum + processingFee;
  const feeBand = getFeeBandDescription(withdrawAmountNum);

  const fetchWalletData = async () => {
    try {
      setIsRefreshing(true);
      const balanceResult = await getUserBalance();

      if (balanceResult.success && balanceResult.data) {
        setCurrentBalance(balanceResult.data.balance);
      }
    } catch (error) {
      setMessage('Failed to load wallet data. Please try refreshing.');
      setMessageType('error');
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchWalletData();
  }, []);

  useEffect(() => {
    if (user?.phone) {
      if (!mpesaNumber) setMpesaNumber(user.phone);
    }
  }, [user]);

  const handleRefresh = async () => {
    await fetchWalletData();
    setMessage('Wallet data refreshed successfully.');
    setMessageType('success');
  };

  const handleWithdraw = async () => {
    setMessage(null);
    const amount = parseFloat(withdrawAmount);

    if (isNaN(amount) || amount < MIN_WITHDRAWAL) {
      setMessage(`Minimum withdrawal amount is KES ${MIN_WITHDRAWAL}.`);
      setMessageType('error');
      return;
    }
    
    // Check balance including processing fee
    const fee = calculateProcessingFee(amount);
    const totalRequired = amount + fee;
    if (totalRequired > currentBalance) {
      setMessage(`Insufficient balance. You need KSh ${totalRequired.toFixed(0)} (amount + KSh ${fee} fee). Available: KSh ${currentBalance.toFixed(0)}.`);
      setMessageType('error');
      return;
    }

    const cleanMpesaNumber = mpesaNumber.replace(/\s/g, '');
    if (!cleanMpesaNumber.match(/^254[0-9]{9}$/)) {
      setMessage('Please enter a valid M-Pesa number in format 2547XXXXXXXX or 2541XXXXXXXX.');
      setMessageType('error');
      return;
    }

    setIsProcessingWithdraw(true);
    try {
      const result = await processWithdrawal({ amount, mpesaNumber: cleanMpesaNumber });

      if (result.success && result.data) {
        setMessage(
          `Withdrawal request submitted! Transaction ID: ${result.data.transactionCode}. ` +
          `Processing fee: KES ${result.data.processingFee}. Pending admin approval.`
        );
        setMessageType('success');
        setWithdrawAmount('');
        await fetchWalletData();
      } else {
        setMessage(result.message || 'Withdrawal failed. Please try again.');
        setMessageType('error');
      }
    } catch (error) {
      setMessage('An error occurred while processing your withdrawal.');
      setMessageType('error');
    } finally {
      setIsProcessingWithdraw(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-extrabold text-gray-800">Wallet</h2>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:bg-blue-300"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {message && <Alert type={messageType} message={message} onClose={() => setMessage(null)} />}

      {/* Balance Card */}
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 text-white p-6 rounded-xl shadow-lg mb-6">
        <p className="text-sm font-medium opacity-80 mb-1">Available Balance</p>
        <p className="text-4xl font-extrabold">KES {currentBalance.toFixed(2)}</p>
        <p className="text-xs opacity-70 mt-2">Last updated: {new Date().toLocaleTimeString()}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Deposit via M-Pesa */}
        <div className="bg-white p-6 rounded-xl shadow border border-gray-200">
          <h4 className="font-semibold text-lg text-gray-700 flex items-center gap-2 mb-4">
            <DollarSign size={20} className="text-green-600" />
            Deposit Funds
          </h4>

          <div className="space-y-4">
            <div>
              <label htmlFor="depositPhone" className="block text-sm font-medium text-gray-700 mb-1">
                M-Pesa Phone Number
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  id="depositPhone"
                  type="tel"
                  value={depositPhoneNumber}
                  onChange={(e) => setDepositPhoneNumber(e.target.value)}
                  placeholder="07XXXXXXXX"
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  maxLength={12}
                />
              </div>
            </div>

            {depositPhoneNumber && (
              <PaymentMethodSelector
                amount={30} // KES 30 default deposit
                customAmountCents={depositAmountCents}
                reference={`DEPOSIT_${Date.now()}`}
                phoneNumber={depositPhoneNumber}
                narration="Wallet Deposit"
                onSuccess={() => {
                  setMessage('Deposit initiated. Completing your payment...');
                  setMessageType('info');
                  setTimeout(() => {
                    setMessage('Deposit successful! Your wallet has been updated.');
                    setMessageType('success');
                    setDepositPhoneNumber('');
                    fetchWalletData();
                  }, 2000);
                }}
                onError={(error) => {
                  setMessage(`Deposit failed: ${error.message || 'Please try again'}`);
                  setMessageType('error');
                }}
              />
            )}
          </div>
        </div>

        {/* Withdrawal Section */}
        <div className="bg-white p-6 rounded-xl shadow border border-gray-200">
          <h4 className="font-semibold text-lg text-gray-700 flex items-center gap-2 mb-4">
            <Send size={20} className="text-red-500" />
            Withdraw to M-Pesa
          </h4>

          <div className="space-y-4">
            <div>
              <label htmlFor="withdrawAmount" className="block text-sm font-medium text-gray-700 mb-1">
                Amount (KES) — min KES {MIN_WITHDRAWAL}
              </label>
              <input
                id="withdrawAmount"
                type="number"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                placeholder={`Min KES ${MIN_WITHDRAWAL}`}
                min={MIN_WITHDRAWAL}
                step="1"
                disabled={isProcessingWithdraw}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 disabled:bg-gray-100"
              />
            </div>

            {/* Fee Preview - Band-based system */}
            {withdrawAmountNum >= MIN_WITHDRAWAL && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm text-orange-800 space-y-1">
                <div className="flex justify-between">
                  <span>Withdrawal amount:</span>
                  <span className="font-medium">KSh {withdrawAmountNum.toFixed(0)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Processing fee ({feeBand}):</span>
                  <span className="font-medium text-red-600">KSh {processingFee}</span>
                </div>
                <div className="flex justify-between border-t border-orange-300 pt-1 font-semibold">
                  <span>Total deducted from wallet:</span>
                  <span className="text-red-700">KSh {totalDeduction.toFixed(0)}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>You receive via M-Pesa:</span>
                  <span className="text-green-700">KSh {withdrawAmountNum.toFixed(0)}</span>
                </div>
              </div>
            )}

            <div>
              <label htmlFor="withdrawMpesa" className="block text-sm font-medium text-gray-700 mb-1">
                M-Pesa Number
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  id="withdrawMpesa"
                  type="tel"
                  value={mpesaNumber}
                  onChange={(e) => setMpesaNumber(e.target.value)}
                  placeholder="2547XXXXXXXX or 2541XXXXXXXX"
                  disabled={isProcessingWithdraw}
                  className="w-full pl-10 pr-4 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 disabled:bg-gray-100"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Format: 2547XXXXXXXX or 2541XXXXXXXX</p>
            </div>

            <button
              onClick={handleWithdraw}
              disabled={isProcessingWithdraw || withdrawAmountNum < MIN_WITHDRAWAL}
              className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white font-semibold rounded-lg shadow transition duration-200 flex items-center justify-center gap-2"
            >
              {isProcessingWithdraw ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  Processing...
                </>
              ) : (
                'Withdraw'
              )}
            </button>

            <div className="p-4 bg-blue-50 rounded-lg text-sm text-blue-700 space-y-1">
              <p className="font-semibold text-blue-800 mb-1">Withdrawal Information:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Minimum withdrawal: KSh {MIN_WITHDRAWAL}</li>
                <li className="font-medium">Processing fees (band-based):</li>
                <ul className="ml-4 list-none space-y-0.5 text-xs">
                  <li>KSh 200 - 1,000: <strong>KSh 10</strong></li>
                  <li>KSh 1,001 - 2,000: <strong>KSh 20</strong></li>
                  <li>KSh 2,001 - 5,000: <strong>KSh 30</strong></li>
                  <li>KSh 5,001 - 10,000: <strong>KSh 50</strong></li>
                  <li>Above KSh 10,000: <strong>KSh 100</strong></li>
                </ul>
                <li>Withdrawals are allowed any day, any time</li>
                <li>Funds are sent to your M-Pesa number</li>
                <li>Processing may take up to 12 hours after admin approval</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
