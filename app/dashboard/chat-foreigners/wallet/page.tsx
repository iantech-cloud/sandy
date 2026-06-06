'use client';

import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, ArrowLeft, Wallet, TrendingUp, PiggyBank } from 'lucide-react';
import { useRouter } from 'next/navigation';
import DepositModal from '../components/DepositModal';

interface Transaction {
  id: string;
  amount_cents: number;
  type: string;
  description: string;
  status: string;
  createdAt: string;
}

interface WalletData {
  balance_cents: number;
  total_earned_cents: number;
  total_deposited_cents: number;
}

const CREDIT_TYPES = new Set(['CHAT_DEPOSIT', 'CHAT_EARNINGS', 'REFERRAL', 'BONUS', 'REFERRAL_BONUS']);
const DEBIT_TYPES = new Set(['CHAT_WITHDRAWAL', 'UNLOCK', 'UNLOCK_FEE']);
// PLATFORM_FEE transactions are internal company records — never shown to users
const HIDDEN_TYPES = new Set(['PLATFORM_FEE']);

function getTransactionSign(type: string) {
  return DEBIT_TYPES.has(type) ? '-' : '+';
}

function getAmountColor(type: string) {
  if (DEBIT_TYPES.has(type)) return 'text-red-500';
  return 'text-emerald-600';
}

function getIconBg(type: string) {
  if (DEBIT_TYPES.has(type)) return 'bg-red-50';
  if (type === 'CHAT_DEPOSIT') return 'bg-blue-50';
  return 'bg-emerald-50';
}

function TransactionIcon({ type }: { type: string }) {
  if (DEBIT_TYPES.has(type)) return <ArrowUp className="text-red-500" size={18} />;
  if (type === 'CHAT_DEPOSIT') return <ArrowDown className="text-blue-600" size={18} />;
  return <TrendingUp className="text-emerald-600" size={18} />;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    completed: 'bg-emerald-100 text-emerald-700',
    pending: 'bg-amber-100 text-amber-700',
    failed: 'bg-red-100 text-red-600',
  };
  const cls = map[status.toLowerCase()] ?? 'bg-slate-100 text-slate-600';
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${cls}`}>
      {status}
    </span>
  );
}

export default function WalletPage() {
  const router = useRouter();
  const [wallet, setWallet] = useState<WalletData>({ balance_cents: 0, total_earned_cents: 0, total_deposited_cents: 0 });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDepositModal, setShowDepositModal] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [walletRes, txRes] = await Promise.all([
          fetch('/api/chat-foreigners/wallet'),
          fetch('/api/chat-foreigners/wallet?type=transactions&limit=50'),
        ]);

        const [walletData, txData] = await Promise.all([
          walletRes.json(),
          txRes.json(),
        ]);

        if (walletData.success) {
          setWallet(walletData.data);
        } else {
          setError(walletData.error || 'Could not load wallet');
        }

        if (txData.success) {
          const visible = (txData.data.transactions ?? []).filter(
            (tx: Transaction) => !HIDDEN_TYPES.has(tx.type)
          );
          setTransactions(visible);
        }
      } catch (err) {
        setError('Network error — please refresh and try again.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
          <p className="text-slate-400 text-sm">Loading wallet...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-slate-950/90 backdrop-blur-sm border-b border-slate-800 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-800 transition"
          aria-label="Go back"
        >
          <ArrowLeft size={20} className="text-slate-300" />
        </button>
        <h1 className="text-lg font-semibold text-white">Chat Wallet</h1>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {error && (
          <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-xl p-4 text-sm">
            {error}
          </div>
        )}

        {/* Balance cards */}
        <div className="grid grid-cols-1 gap-4">
          {/* Main balance */}
          <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-indigo-200 text-sm font-medium">Available Balance</p>
                <h2 className="text-4xl font-bold text-white mt-1">
                  KES {(wallet.balance_cents / 100).toFixed(2)}
                </h2>
              </div>
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <Wallet size={24} className="text-white" />
              </div>
            </div>
            <button
              onClick={() => setShowDepositModal(true)}
              className="w-full bg-white text-indigo-700 font-semibold py-2.5 rounded-xl hover:bg-indigo-50 transition flex items-center justify-center gap-2"
            >
              <Plus size={18} />
              Deposit Funds
            </button>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp size={16} className="text-emerald-500" />
                <p className="text-slate-400 text-sm">Total Earned</p>
              </div>
              <p className="text-xl font-bold text-white">
                KES {(wallet.total_earned_cents / 100).toFixed(2)}
              </p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <PiggyBank size={16} className="text-blue-500" />
                <p className="text-slate-400 text-sm">Total Deposited</p>
              </div>
              <p className="text-xl font-bold text-white">
                KES {(wallet.total_deposited_cents / 100).toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        {/* Transaction history */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
            <h2 className="font-semibold text-white">Transaction History</h2>
            <span className="text-slate-500 text-sm">{transactions.length} entries</span>
          </div>

          {transactions.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <Wallet size={32} className="text-slate-700 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">No transactions yet</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {transactions.map((tx) => (
                <div key={tx.id} className="px-5 py-4 flex items-center justify-between gap-4 hover:bg-slate-800/50 transition">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${getIconBg(tx.type)}`}>
                      <TransactionIcon type={tx.type} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {(tx.description || tx.type).replace(/\s*\([^)]*\)/g, '')}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {new Date(tx.createdAt).toLocaleDateString('en-KE', {
                          day: 'numeric', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`font-bold text-sm ${getAmountColor(tx.type)}`}>
                      {getTransactionSign(tx.type)}KES {(tx.amount_cents / 100).toFixed(2)}
                    </p>
                    <div className="mt-1">
                      <StatusBadge status={tx.status} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <DepositModal isOpen={showDepositModal} onClose={() => setShowDepositModal(false)} />
    </div>
  );
}
