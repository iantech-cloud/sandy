'use client';

import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowLeft, Wallet, TrendingUp, Users, MessageSquare, Plus, RefreshCw } from 'lucide-react';
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
  downline_earnings_cents: number;
  chat_earnings_cents: number;
}

const DEBIT_TYPES = new Set(['CHAT_WITHDRAWAL', 'UNLOCK', 'UNLOCK_FEE']);
const HIDDEN_TYPES = new Set(['PLATFORM_FEE']);
const DOWNLINE_TYPES = new Set(['REFERRAL', 'CHAT_REFERRAL_EARNING']);
const CHAT_EARNING_TYPES = new Set(['CHAT_MESSAGE_EARNING', 'CHAT_EARNINGS']);

// Human-readable label overrides — used when the stored description is stale or unclear
const TX_LABEL_MAP: Record<string, string> = {
  CHAT_DEPOSIT:          'Chat wallet deposit',
  CHAT_MESSAGE_EARNING:  'Chat message earning',
  CHAT_WITHDRAWAL:       'Chat wallet withdrawal',
  CHAT_REFERRAL_EARNING: 'Downline bot-unlock commission',
  CHAT_EARNINGS:         'Chat Foreigners earnings',
  REFERRAL:              'Referral bonus',
};

// Correct the description shown so "Milestone bonus: referred user reached 20 messages"
// is no longer displayed. If the stored description is stale, override it.
function friendlyDescription(tx: Transaction): string {
  // If description contains old incorrect copy, replace it
  const raw = tx.description || '';
  if (
    raw.toLowerCase().includes('milestone') ||
    raw.toLowerCase().includes('20 messages') ||
    raw.toLowerCase().includes('reached 20')
  ) {
    return 'Downline bot-unlock commission (KES 10)';
  }
  return raw || TX_LABEL_MAP[tx.type] || tx.type;
}

function isDownlineTx(type: string) {
  return DOWNLINE_TYPES.has(type) && type !== 'CHAT_DEPOSIT';
}

function isChatEarningTx(type: string) {
  return CHAT_EARNING_TYPES.has(type);
}

function getTransactionSign(type: string) {
  return DEBIT_TYPES.has(type) ? '-' : '+';
}

function getAmountColor(type: string) {
  if (DEBIT_TYPES.has(type)) return 'text-red-400';
  if (type === 'CHAT_DEPOSIT') return 'text-blue-400';
  if (isDownlineTx(type)) return 'text-amber-400';
  return 'text-emerald-400';
}

function getIconBg(type: string) {
  if (DEBIT_TYPES.has(type)) return 'bg-red-500/20';
  if (type === 'CHAT_DEPOSIT') return 'bg-blue-500/20';
  if (isDownlineTx(type)) return 'bg-amber-500/20';
  return 'bg-emerald-500/20';
}

function TransactionIcon({ type }: { type: string }) {
  if (DEBIT_TYPES.has(type)) return <ArrowUp className="text-red-400" size={16} />;
  if (type === 'CHAT_DEPOSIT') return <ArrowDown className="text-blue-400" size={16} />;
  if (isDownlineTx(type)) return <Users className="text-amber-400" size={16} />;
  return <MessageSquare className="text-emerald-400" size={16} />;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    completed: 'bg-emerald-500/20 text-emerald-400',
    pending: 'bg-amber-500/20 text-amber-400',
    failed: 'bg-red-500/20 text-red-400',
  };
  const cls = map[status.toLowerCase()] ?? 'bg-slate-700 text-slate-400';
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${cls}`}>
      {status}
    </span>
  );
}

function WalletCard({
  amount_cents,
  icon,
  gradient,
}: {
  amount_cents: number;
  icon: React.ReactNode;
  gradient: string;
}) {
  return (
    <div className={`rounded-2xl p-5 ${gradient} relative overflow-hidden flex items-center justify-between`}>
      <p className="text-3xl font-bold text-white tracking-tight">
        KES {(amount_cents / 100).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </p>
      <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0 ml-3">
        {icon}
      </div>
    </div>
  );
}

export default function WalletPage() {
  const router = useRouter();
  const [wallet, setWallet] = useState<WalletData>({
    balance_cents: 0,
    total_earned_cents: 0,
    total_deposited_cents: 0,
    downline_earnings_cents: 0,
    chat_earnings_cents: 0,
  });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'downline' | 'chat'>('all');

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [walletRes, txRes] = await Promise.all([
        fetch('/api/chat-foreigners/wallet'),
        fetch('/api/chat-foreigners/wallet?type=transactions&limit=100'),
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
    } catch {
      setError('Network error — please refresh and try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filteredTxs = transactions.filter((tx) => {
    if (activeTab === 'downline') return isDownlineTx(tx.type);
    if (activeTab === 'chat') return isChatEarningTx(tx.type);
    return true;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a12] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-[#00c97a] border-t-transparent animate-spin" />
          <p className="text-zinc-500 text-sm">Loading wallet...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a12] text-white">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-[#0a0a12]/90 backdrop-blur-sm border-b border-zinc-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-zinc-800 transition"
            aria-label="Go back"
          >
            <ArrowLeft size={20} className="text-zinc-300" />
          </button>
          <h1 className="text-base font-bold text-white">Chat Foreigners Wallet</h1>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-zinc-800 transition"
          aria-label="Refresh"
        >
          <RefreshCw size={16} className={`text-zinc-400 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-5">
        {error && (
          <div className="bg-red-900/30 border border-red-800 text-red-300 rounded-xl p-4 text-sm">
            {error}
          </div>
        )}

        {/* Two wallet cards */}
        <div className="space-y-3">
          <WalletCard
            amount_cents={wallet.downline_earnings_cents}
            icon={<Users size={20} className="text-white" />}
            gradient="bg-gradient-to-br from-amber-600 to-orange-700"
          />
          <WalletCard
            amount_cents={wallet.chat_earnings_cents}
            icon={<MessageSquare size={20} className="text-white" />}
            gradient="bg-gradient-to-br from-[#00c97a] to-emerald-700"
          />
        </div>

        {/* Total balance + deposit */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-zinc-500 text-xs font-semibold uppercase tracking-widest mb-0.5">Total Balance</p>
              <p className="text-3xl font-bold text-white">
                KES {(wallet.balance_cents / 100).toLocaleString('en-KE', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="w-11 h-11 bg-zinc-800 rounded-xl flex items-center justify-center">
              <Wallet size={20} className="text-[#00c97a]" />
            </div>
          </div>
          <button
            onClick={() => setShowDepositModal(true)}
            className="w-full bg-[#00c97a] hover:bg-[#00b56c] text-black font-bold py-3 rounded-xl transition flex items-center justify-center gap-2 text-sm"
          >
            <Plus size={17} />
            Deposit Funds
          </button>
        </div>

        {/* Stat row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center gap-1.5 mb-1.5">
              <TrendingUp size={14} className="text-[#00c97a]" />
              <p className="text-zinc-500 text-xs">Total Earned</p>
            </div>
            <p className="text-lg font-bold text-white">
              KES {(wallet.total_earned_cents / 100).toLocaleString('en-KE', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center gap-1.5 mb-1.5">
              <ArrowDown size={14} className="text-blue-400" />
              <p className="text-zinc-500 text-xs">Total Deposited</p>
            </div>
            <p className="text-lg font-bold text-white">
              KES {(wallet.total_deposited_cents / 100).toLocaleString('en-KE', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        {/* Transaction history */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
            <h2 className="font-bold text-sm text-white">Transactions</h2>
            <span className="text-zinc-600 text-xs">{filteredTxs.length} entries</span>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-zinc-800">
            {(['all', 'downline', 'chat'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2.5 text-xs font-semibold transition capitalize ${
                  activeTab === tab
                    ? 'text-[#00c97a] border-b-2 border-[#00c97a]'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {tab === 'all' ? 'All' : tab === 'downline' ? 'Downline' : 'Chat'}
              </button>
            ))}
          </div>

          {filteredTxs.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <Wallet size={28} className="text-zinc-700 mx-auto mb-3" />
              <p className="text-zinc-600 text-sm">No transactions yet</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-800 max-h-96 overflow-y-auto">
              {filteredTxs.map((tx) => (
                <div key={tx.id} className="px-4 py-3.5 flex items-center justify-between gap-3 hover:bg-zinc-800/40 transition">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${getIconBg(tx.type)}`}>
                      <TransactionIcon type={tx.type} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-zinc-200 truncate leading-tight">
                        {friendlyDescription(tx)}
                      </p>
                      <p className="text-[10px] text-zinc-600 mt-0.5">
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
                    <div className="mt-0.5">
                      <StatusBadge status={tx.status} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bottom padding */}
        <div className="h-4" />
      </div>

      <DepositModal isOpen={showDepositModal} onClose={() => setShowDepositModal(false)} />
    </div>
  );
}
