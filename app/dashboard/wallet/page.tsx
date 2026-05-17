// app/dashboard/wallet/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DollarSign, Phone, Loader2, CheckCircle, AlertCircle, RefreshCw, Send } from 'lucide-react';
import TransactionHistory from '@/app/ui/dashboard/TransactionHistory';
import Alert from '@/app/ui/Alert';
import { useDashboard } from '../../dashboard/DashboardContext';
import { processWithdrawal } from '@/app/actions/transactions';
import { getDepositHistory, getUserBalance } from '@/app/actions/deposit';
import { formatPhoneNumber, getMpesaPhoneFormat } from '@/app/lib/utils/phoneFormatter';

// Match the Transaction interface from TransactionHistory
interface Transaction {
  id: string;
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'BONUS' | 'TASK_PAYMENT' | 'SPIN_WIN' | 'REFERRAL' | 'SURVEY' | 'ACTIVATION_FEE' | 'COMPANY_REVENUE' | 'ACCOUNT_ACTIVATION';
  amount: number;
  description: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled' | 'timeout';
  date: string;
  transaction_code?: string;
  mpesa_receipt_number?: string;
}

const PROCESSING_FEE_PERCENT = 2;
const MIN_WITHDRAWAL = 200;

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

// Map raw transaction to local Transaction type
function transformTransaction(tx: any): Transaction {
  let amount = 0;
  if (typeof tx.amount === 'number' && !isNaN(tx.amount)) {
    amount = tx.amount;
  } else if (typeof tx.amount_cents === 'number' && !isNaN(tx.amount_cents)) {
    amount = tx.amount_cents / 100;
  }

  const date = tx.created_at || tx.date || tx.transaction_date || new Date().toISOString();

  const typeMap: Record<string, Transaction['type']> = {
    DEPOSIT: 'DEPOSIT',
    WITHDRAW: 'WITHDRAWAL',
    WITHDRAWAL: 'WITHDRAWAL',
    BONUS: 'BONUS',
    TASK_PAYMENT: 'TASK_PAYMENT',
    SPIN_WIN: 'SPIN_WIN',
    REFERRAL: 'REFERRAL',
    SURVEY: 'SURVEY',
    ACTIVATION_FEE: 'ACTIVATION_FEE',
    ACCOUNT_ACTIVATION: 'ACCOUNT_ACTIVATION',
    COMPANY_REVENUE: 'COMPANY_REVENUE',
  };

  const type: Transaction['type'] = typeMap[(tx.type || '').toUpperCase()] ?? 'DEPOSIT';

  return {
    id: tx.id || tx._id?.toString() || `tx-${Date.now()}-${Math.random()}`,
    type,
    amount,
    description: tx.description || `Transaction ${tx.type || 'DEPOSIT'}`,
    date,
    status: tx.status || 'completed',
    transaction_code: tx.transaction_code,
    mpesa_receipt_number: tx.mpesaReceiptNumber || tx.mpesa_receipt_number,
  };
}

export default function WalletPage() {
  const { user } = useDashboard();
  const router = useRouter();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [mpesaNumber, setMpesaNumber] = useState(user?.phone || '');
  const [isProcessingWithdraw, setIsProcessingWithdraw] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
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

  // Computed fee preview
  const withdrawAmountNum = parseFloat(withdrawAmount) || 0;
  const feeCents = Math.round(withdrawAmountNum * PROCESSING_FEE_PERCENT) / 100;
  const youReceive = Math.max(0, withdrawAmountNum - feeCents);

  const fetchWalletData = async () => {
    try {
      setIsRefreshing(true);
      const [historyResult, balanceResult] = await Promise.all([
        getDepositHistory(50, 1),
        getUserBalance(),
      ]);

      if (historyResult.success && historyResult.data) {
        const transformed = historyResult.data
          .map(transformTransaction)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setTransactions(transformed);
      } else {
        setTransactions([]);
      }

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

    if (amount > currentBalance) {
      setMessage(`Insufficient balance. Available: KES ${currentBalance.toFixed(2)}.`);
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
        {/* Deposit via M-Pesa — temporarily disabled */}
        <div className="bg-white p-6 rounded-xl shadow border border-gray-200">
          <h4 className="font-semibold text-lg text-gray-700 flex items-center gap-2 mb-4">
            <DollarSign size={20} className="text-gray-400" />
            Deposit via M-Pesa
          </h4>

          <div className="rounded-lg bg-gray-50 border border-gray-200 p-4 text-center text-gray-500 text-sm mb-4">
            Deposits via M-Pesa are temporarily unavailable. Please check back soon.
          </div>

          <button
            disabled
            className="w-full py-3 bg-gray-300 text-gray-500 font-semibold rounded-lg cursor-not-allowed"
          >
            Deposit via M-Pesa (Coming Soon)
          </button>
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

            {/* Fee Preview */}
            {withdrawAmountNum >= MIN_WITHDRAWAL && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm text-orange-800 space-y-1">
                <div className="flex justify-between">
                  <span>Withdrawal amount:</span>
                  <span className="font-medium">KES {withdrawAmountNum.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Processing fee ({PROCESSING_FEE_PERCENT}%):</span>
                  <span className="font-medium text-red-600">- KES {feeCents.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t border-orange-300 pt-1 font-semibold">
                  <span>You receive:</span>
                  <span className="text-green-700">KES {youReceive.toFixed(2)}</span>
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
                <li>Minimum withdrawal: KES {MIN_WITHDRAWAL}</li>
                <li>Processing fee: {PROCESSING_FEE_PERCENT}% of the withdrawal amount</li>
                <li>Withdrawals are allowed any day, any time</li>
                <li>Funds are sent to your M-Pesa number</li>
                <li>Processing may take up to 24 hours after admin approval</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Transaction History */}
      <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-gray-800">Transaction History</h3>
          <span className="text-sm text-gray-500">{transactions.length} transaction{transactions.length !== 1 ? 's' : ''}</span>
        </div>
        <TransactionHistory transactions={transactions} title="" limit={30} />
      </div>
    </div>
  );
}
