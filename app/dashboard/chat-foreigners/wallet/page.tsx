'use client';

import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Plus } from 'lucide-react';
import DepositModal from '../components/DepositModal';

interface Transaction {
  id: string;
  amount_cents: number;
  type: 'CHAT_DEPOSIT' | 'CHAT_EARNINGS' | 'CHAT_WITHDRAWAL';
  description: string;
  status: string;
  createdAt: string;
}

export default function WalletPage() {
  const [wallet, setWallet] = useState({ balance_cents: 0, total_earned_cents: 0, total_deposited_cents: 0 });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDepositModal, setShowDepositModal] = useState(false);

  useEffect(() => {
    const loadWalletData = async () => {
      try {
        // Load wallet balance
        const walletRes = await fetch('/api/chat-foreigners/wallet');
        const walletData = await walletRes.json();
        if (walletData.success) {
          setWallet(walletData.data);
        }

        // Load transactions
        const txRes = await fetch('/api/chat-foreigners/wallet?type=transactions');
        const txData = await txRes.json();
        if (txData.success) {
          setTransactions(txData.data.transactions);
        }
      } catch (error) {
        console.error('Error loading wallet:', error);
      } finally {
        setLoading(false);
      }
    };

    loadWalletData();
  }, []);

  const getTransactionIcon = (type: string) => {
    if (type === 'CHAT_DEPOSIT') return <ArrowDown className="text-green-600" size={20} />;
    if (type === 'CHAT_EARNINGS') return <ArrowUp className="text-blue-600" size={20} />;
    return <ArrowUp className="text-red-600" size={20} />;
  };

  const getTransactionColor = (type: string) => {
    if (type === 'CHAT_DEPOSIT') return 'text-green-600';
    if (type === 'CHAT_EARNINGS') return 'text-blue-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="animate-spin">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 py-8 px-4 md:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Chat Foreigners Wallet</h1>
          <p className="text-slate-600">Manage your funds and earnings</p>
        </div>

        {/* Wallet Balance Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Current Balance */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-slate-600 font-semibold">Current Balance</p>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <ArrowDown className="text-blue-600" size={24} />
              </div>
            </div>
            <h2 className="text-3xl font-bold text-slate-900 mb-4">KES {(wallet.balance_cents / 100).toFixed(0)}</h2>
            <button
              onClick={() => setShowDepositModal(true)}
              className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2 font-semibold"
            >
              <Plus size={20} />
              Deposit
            </button>
          </div>

          {/* Total Earned */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-slate-600 font-semibold">Total Earned</p>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <ArrowUp className="text-green-600" size={24} />
              </div>
            </div>
            <h2 className="text-3xl font-bold text-slate-900">KES {(wallet.total_earned_cents / 100).toFixed(0)}</h2>
          </div>

          {/* Total Deposited */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-slate-600 font-semibold">Total Deposited</p>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <ArrowDown className="text-purple-600" size={24} />
              </div>
            </div>
            <h2 className="text-3xl font-bold text-slate-900">KES {(wallet.total_deposited_cents / 100).toFixed(0)}</h2>
          </div>
        </div>

        {/* Transaction History */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-6 border-b border-slate-200">
            <h2 className="text-xl font-bold text-slate-900">Transaction History</h2>
          </div>

          {transactions.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <p>No transactions yet</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {transactions.map((tx) => (
                <div key={tx.id} className="p-6 flex items-center justify-between hover:bg-slate-50 transition">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center">
                      {getTransactionIcon(tx.type)}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-slate-900">{tx.description}</p>
                      <p className="text-sm text-slate-500">{new Date(tx.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold text-lg ${getTransactionColor(tx.type)}`}>
                      {tx.type === 'CHAT_WITHDRAWAL' ? '-' : '+'}KES {(tx.amount_cents / 100).toFixed(0)}
                    </p>
                    <p className="text-sm text-slate-500 capitalize">{tx.status}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Deposit Modal */}
      <DepositModal isOpen={showDepositModal} onClose={() => setShowDepositModal(false)} />
    </div>
  );
}
