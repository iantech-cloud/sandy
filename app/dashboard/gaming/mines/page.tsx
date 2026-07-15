'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Wallet, RotateCcw, Bomb, Star, Loader } from 'lucide-react';
import Link from 'next/link';
import { playMines, getGamingWallet } from '@/app/actions/gaming-games';

export default function MinesGame() {
  const router = useRouter();
  const { data: session } = useSession();

  const [bet, setBet] = useState(3000);
  const [mineCount, setMineCount] = useState(5);
  const [gameActive, setGameActive] = useState(false);
  const [revealed, setRevealed] = useState<boolean[]>(new Array(25).fill(false));
  const [mines, setMines] = useState<number[]>([]);
  const [balance, setBalance] = useState(0);
  const [gameHistory, setGameHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadWallet();
  }, []);

  const loadWallet = async () => {
    const result = await getGamingWallet();
    if (result.success && result.wallet) {
      setBalance(result.wallet.balance_cents);
    }
  };

  const initializeGame = () => {
    if (bet > balance) {
      alert('Insufficient balance');
      return;
    }
    if (bet < 3000) {
      alert('Minimum bet is KES 30');
      return;
    }

    const minePositions = Array(mineCount)
      .fill(0)
      .map(() => Math.floor(Math.random() * 25));
    setMines(minePositions);
    setRevealed(new Array(25).fill(false));
    setGameActive(true);
  };

  const clickTile = async (index: number) => {
    if (!gameActive || revealed[index] || loading) return;

    const newRevealed = [...revealed];
    newRevealed[index] = true;
    setRevealed(newRevealed);

    // Always hit mine after short delay
    setTimeout(async () => {
      setLoading(true);
      try {
        const result = await playMines(bet, mineCount, newRevealed.map((r, i) => (r ? i : -1)).filter(i => i >= 0));
        if (result.success) {
          setBalance(result.wallet?.balance_cents || 0);
          setGameHistory(prev => [
            {
              mines: mineCount,
              result: 'loss',
              amount: bet,
              timestamp: new Date().toLocaleTimeString(),
            },
            ...prev.slice(0, 9),
          ]);
        }
      } finally {
        setLoading(false);
        setGameActive(false);
      }
    }, 500);
  };

  const resetGame = () => {
    setRevealed(new Array(25).fill(false));
    setMines([]);
    setGameActive(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Link href="/dashboard/gaming" className="flex items-center gap-2 text-purple-300 hover:text-purple-200">
            <ArrowLeft size={20} />
            Back to Gaming
          </Link>
          <div className="flex items-center gap-3 bg-slate-800/50 px-4 py-2 rounded-lg border border-purple-500/30">
            <Wallet size={20} className="text-purple-400" />
            <div>
              <p className="text-xs text-slate-400">Balance</p>
              <p className="text-xl font-bold text-white">KES {(balance / 100).toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Game Area */}
          <div className="lg:col-span-2">
            <div className="bg-slate-800/50 border border-purple-500/30 rounded-xl p-6">
              <h2 className="text-2xl font-bold text-white mb-4">Mines</h2>

              {/* Grid */}
              <div className="bg-slate-900 p-6 rounded-lg mb-6">
                <div className="grid grid-cols-5 gap-3">
                  {Array(25)
                    .fill(0)
                    .map((_, i) => (
                      <button
                        key={i}
                        onClick={() => clickTile(i)}
                        disabled={!gameActive || revealed[i] || loading}
                        className={`aspect-square rounded-lg font-bold text-lg transition-all ${
                          revealed[i]
                            ? mines.includes(i)
                              ? 'bg-red-600 text-white border border-red-400'
                              : 'bg-green-600 text-white border border-green-400'
                            : 'bg-slate-700 hover:bg-slate-600 border border-purple-500/30 text-white hover:text-purple-300'
                        } ${!gameActive && 'cursor-not-allowed'}`}
                      >
                        {revealed[i] && mines.includes(i) && <Bomb size={20} className="mx-auto" />}
                      </button>
                    ))}
                </div>
              </div>

              {/* Controls */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-slate-400 mb-2 block">Bet Amount</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={bet / 100}
                        onChange={e => setBet(Math.max(30, parseInt(e.target.value) || 30) * 100)}
                        disabled={gameActive || loading}
                        className="flex-1 bg-slate-700 border border-purple-500/30 rounded-lg px-4 py-2 text-white disabled:opacity-50"
                      />
                      <span className="text-slate-400">KES</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-slate-400 mb-2 block">Mines</label>
                    <select
                      value={mineCount}
                      onChange={e => setMineCount(parseInt(e.target.value))}
                      disabled={gameActive || loading}
                      className="w-full bg-slate-700 border border-purple-500/30 rounded-lg px-4 py-2 text-white disabled:opacity-50"
                    >
                      {Array(20)
                        .fill(0)
                        .map((_, i) => (
                          <option key={i + 1} value={i + 1}>
                            {i + 1} Mines
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                {/* Quick Bet Buttons */}
                <div className="flex gap-2 flex-wrap">
                  {[30, 60, 90, 120, 500, 1000].map(amount => (
                    <button
                      key={amount}
                      onClick={() => setBet(amount * 100)}
                      disabled={gameActive || amount * 100 > balance || loading}
                      className="px-3 py-1 bg-slate-700 hover:bg-slate-600 border border-purple-500/30 rounded-lg text-white text-sm disabled:opacity-50 transition-colors"
                    >
                      KES {amount}
                    </button>
                  ))}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                  {!gameActive ? (
                    <button
                      onClick={initializeGame}
                      disabled={loading || balance < bet}
                      className="flex-1 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 text-white font-bold py-3 rounded-lg disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
                    >
                      {loading ? <Loader size={20} className="animate-spin" /> : null}
                      {loading ? 'Playing...' : 'Start Game'}
                    </button>
                  ) : (
                    <button
                      onClick={resetGame}
                      className="flex-1 bg-slate-700 hover:bg-slate-600 border border-purple-500/30 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
                    >
                      <RotateCcw size={20} />
                      Try Again
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="bg-slate-800/50 border border-purple-500/30 rounded-xl p-6">
            <h3 className="text-lg font-bold text-white mb-4">Recent Games</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {gameHistory.length === 0 ? (
                <p className="text-slate-400 text-sm">No games yet</p>
              ) : (
                gameHistory.map((game, i) => (
                  <div key={i} className="flex items-center justify-between bg-slate-700/50 p-3 rounded-lg border border-slate-600/50">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-white">{game.mines} Mines</p>
                      <p className="text-xs text-slate-400">{game.timestamp}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-red-400">-KES {(game.amount / 100).toLocaleString()}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
