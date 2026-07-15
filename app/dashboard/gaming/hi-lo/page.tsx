'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Wallet, RotateCcw, Play, Loader, TrendingUp, TrendingDown } from 'lucide-react';
import Link from 'next/link';
import { playHiLo, getGamingWallet } from '@/app/actions/gaming-games';

const CARDS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export default function HiLoGame() {
  const router = useRouter();
  const { data: session } = useSession();

  const [bet, setBet] = useState(3000);
  const [balance, setBalance] = useState(0);
  const [gameActive, setGameActive] = useState(false);
  const [currentCard, setCurrentCard] = useState<string | null>(null);
  const [nextCard, setNextCard] = useState<string | null>(null);
  const [predictions, setPredictions] = useState<Array<{ prediction: 'higher' | 'lower'; result: boolean }>>([]);
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

  const getRandomCard = () => CARDS[Math.floor(Math.random() * CARDS.length)];

  const startGame = () => {
    if (bet > balance) {
      alert('Insufficient balance');
      return;
    }
    if (bet < 3000) {
      alert('Minimum bet is KES 30');
      return;
    }

    setCurrentCard(getRandomCard());
    setNextCard(null);
    setPredictions([]);
    setGameActive(true);
  };

  const makePrediction = async (prediction: 'higher' | 'lower') => {
    if (!gameActive || !currentCard || loading) return;

    setLoading(true);
    const next = getRandomCard();
    setNextCard(next);

    const currentValue = CARDS.indexOf(currentCard);
    const nextValue = CARDS.indexOf(next);

    const isCorrect =
      (prediction === 'higher' && nextValue > currentValue) ||
      (prediction === 'lower' && nextValue < currentValue);

    const newPredictions = [...predictions, { prediction, result: isCorrect }];
    setPredictions(newPredictions);

    // After 3 predictions or wrong guess, end game
    if (!isCorrect || newPredictions.length >= 3) {
      setTimeout(() => {
        endGame(newPredictions);
      }, 500);
    } else {
      // Continue - next card becomes current
      setCurrentCard(next);
      setNextCard(null);
      setLoading(false);
    }
  };

  const endGame = async (finalPredictions: any[]) => {
    try {
      const result = await playHiLo(bet, finalPredictions);

      if (result.success) {
        setBalance(result.wallet?.balance_cents || 0);
        setGameHistory(prev => [
          {
            correct: finalPredictions.filter((p: any) => p.result).length,
            total: finalPredictions.length,
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
      setPredictions([]);
    }
  };

  const resetGame = () => {
    setCurrentCard(null);
    setNextCard(null);
    setPredictions([]);
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
              <h2 className="text-2xl font-bold text-white mb-4">Hi-Lo</h2>

              {!gameActive && !predictions.length ? (
                <div className="bg-slate-900 rounded-lg p-12 text-center mb-6">
                  <p className="text-slate-400 text-lg">Predict if the next card will be higher or lower</p>
                </div>
              ) : (
                <div className="bg-slate-900 rounded-lg p-8 mb-6">
                  {/* Cards Display */}
                  <div className="flex items-center justify-center gap-8 mb-8">
                    {/* Current Card */}
                    <div className="flex flex-col items-center">
                      {currentCard && (
                        <div className="w-24 h-32 bg-gradient-to-br from-purple-600 to-purple-700 rounded-lg flex items-center justify-center border-2 border-purple-400 mb-2">
                          <p className="text-4xl font-bold text-white">{currentCard}</p>
                        </div>
                      )}
                      <p className="text-slate-400 text-sm">Current Card</p>
                    </div>

                    {/* Arrow */}
                    <div className="text-3xl text-slate-400">?</div>

                    {/* Next Card */}
                    <div className="flex flex-col items-center">
                      {nextCard && (
                        <div className="w-24 h-32 bg-gradient-to-br from-green-600 to-green-700 rounded-lg flex items-center justify-center border-2 border-green-400 mb-2">
                          <p className="text-4xl font-bold text-white">{nextCard}</p>
                        </div>
                      )}
                      {gameActive && !nextCard && (
                        <div className="w-24 h-32 bg-slate-700 rounded-lg flex items-center justify-center border-2 border-slate-500 mb-2">
                          <p className="text-slate-400">?</p>
                        </div>
                      )}
                      <p className="text-slate-400 text-sm">Next Card</p>
                    </div>
                  </div>

                  {/* Predictions Track */}
                  {predictions.length > 0 && (
                    <div className="flex gap-2 justify-center mb-6">
                      {predictions.map((p, i) => (
                        <div
                          key={i}
                          className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold ${
                            p.result
                              ? 'bg-green-600 text-white border border-green-400'
                              : 'bg-red-600 text-white border border-red-400'
                          }`}
                        >
                          {p.result ? '✓' : '✗'}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Controls */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={bet / 100}
                    onChange={e => setBet(parseInt(e.target.value) * 100 || 3000)}
                    min={30}
                    disabled={gameActive || loading}
                    className="flex-1 bg-slate-700 border border-purple-500/30 rounded-lg px-4 py-2 text-white disabled:opacity-50"
                  />
                  <span className="text-slate-400">KES</span>
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
                      onClick={startGame}
                      disabled={loading || balance < bet}
                      className="flex-1 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 text-white font-bold py-3 rounded-lg disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
                    >
                      {loading ? <Loader size={20} className="animate-spin" /> : <Play size={20} />}
                      {loading ? 'Playing...' : 'Start Game'}
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => makePrediction('higher')}
                        disabled={loading || !nextCard}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 border border-blue-400 text-white font-bold py-3 rounded-lg disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
                      >
                        <TrendingUp size={20} />
                        Higher
                      </button>
                      <button
                        onClick={() => makePrediction('lower')}
                        disabled={loading || !nextCard}
                        className="flex-1 bg-orange-600 hover:bg-orange-700 border border-orange-400 text-white font-bold py-3 rounded-lg disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
                      >
                        <TrendingDown size={20} />
                        Lower
                      </button>
                    </>
                  )}

                  {predictions.length > 0 && !gameActive && (
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
                      <p className="text-sm font-semibold text-white">
                        {game.correct}/{game.total} Correct
                      </p>
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
