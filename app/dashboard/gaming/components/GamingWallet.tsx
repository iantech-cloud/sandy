'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Wallet, Plus, TrendingUp, ArrowUpRight, ArrowDownLeft, Loader2, AlertCircle } from 'lucide-react';
import GamingDepositModal from './GamingDepositModal';

interface GamingWalletProps {
  onClose?: () => void;
}

export default function GamingWallet({ onClose }: GamingWalletProps) {
  const { data: session } = useSession();
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch gaming wallet balance and transactions
    const fetchGamingWallet = async () => {
      try {
        setLoading(true);
        // This will be connected to the actual gaming wallet API later
        // For now, we'll show placeholder data
        setBalance(0);
        setTransactions([]);
        setError(null);
      } catch (err) {
        console.error('Error fetching gaming wallet:', err);
        setError('Failed to load gaming wallet');
      } finally {
        setLoading(false);
      }
    };

    if (session?.user) {
      fetchGamingWallet();
    }
  }, [session?.user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="animate-spin text-purple-500" size={32} />
      </div>
    );
  }

  return (
    <div className="p-6">
      {error && (
        <div className="mb-6 bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="text-red-400 flex-shrink-0" size={20} />
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      {/* Balance Card */}
      <div className="mb-8 bg-gradient-to-br from-purple-600 to-pink-600 rounded-2xl p-8 text-white shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-purple-100 text-sm font-semibold uppercase tracking-wide mb-2">Gaming Wallet Balance</p>
            <h2 className="text-5xl font-bold">KES {balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h2>
          </div>
          <div className="text-purple-100">
            <Wallet size={48} className="opacity-20" />
          </div>
        </div>

        {/* Balance Stats */}
        <div className="grid grid-cols-2 gap-4 mb-6 pt-6 border-t border-white/20">
          <div>
            <p className="text-purple-100 text-xs uppercase font-semibold mb-1">Total Wagered</p>
            <p className="text-2xl font-bold">KES 0</p>
          </div>
          <div>
            <p className="text-purple-100 text-xs uppercase font-semibold mb-1">Total Winnings</p>
            <p className="text-2xl font-bold">KES 0</p>
          </div>
        </div>

        {/* Deposit Button */}
        <button
          onClick={() => setShowDepositModal(true)}
          className="w-full bg-white text-purple-600 font-bold py-3 px-6 rounded-xl hover:bg-gray-100 transition-colors flex items-center justify-center gap-2 shadow-lg"
        >
          <Plus size={20} />
          Deposit to Gaming Wallet
        </button>
      </div>

      {/* Recent Transactions */}
      <div>
        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <TrendingUp size={24} className="text-purple-400" />
          Recent Activity
        </h3>

        {transactions.length === 0 ? (
          <div className="bg-slate-800/50 border border-purple-500/20 rounded-xl p-8 text-center">
            <Wallet className="mx-auto text-gray-500 mb-3" size={40} />
            <p className="text-gray-400">No transactions yet</p>
            <p className="text-gray-500 text-sm mt-2">Start playing to see your activity here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {transactions.map((txn, idx) => (
              <div
                key={idx}
                className="bg-slate-800/50 border border-purple-500/20 rounded-lg p-4 flex items-center justify-between hover:border-purple-500/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    txn.type === 'deposit' 
                      ? 'bg-green-500/20' 
                      : 'bg-red-500/20'
                  }`}>
                    {txn.type === 'deposit' ? (
                      <ArrowDownLeft className="text-green-400" size={20} />
                    ) : (
                      <ArrowUpRight className="text-red-400" size={20} />
                    )}
                  </div>
                  <div>
                    <p className="text-white font-semibold capitalize">{txn.type} {txn.game}</p>
                    <p className="text-gray-400 text-sm">{new Date(txn.date).toLocaleDateString()}</p>
                  </div>
                </div>
                <p className={`text-lg font-bold ${
                  txn.type === 'deposit' 
                    ? 'text-green-400' 
                    : 'text-red-400'
                }`}>
                  {txn.type === 'deposit' ? '+' : '-'} KES {txn.amount.toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Deposit Modal */}
      {showDepositModal && (
        <GamingDepositModal
          onClose={() => setShowDepositModal(false)}
          onSuccess={() => {
            setShowDepositModal(false);
            // Refresh wallet balance
          }}
        />
      )}
    </div>
  );
}
