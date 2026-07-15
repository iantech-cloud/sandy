'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Wallet, Play, RotateCcw, Loader } from 'lucide-react';
import Link from 'next/link';
import { playDice, getGamingWallet } from '@/app/actions/gaming-games';

export default function DiceGame() {
  const router = useRouter();
  const { data: session } = useSession();

  const [bet, setBet] = useState(3000);
  const [balance, setBalance] = useState(0);
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'lost'>('idle');
  const [prediction, setPrediction] = useState<'under' | 'over' | null>(null);
  const [targetNumber, setTargetNumber] = useState(50);
  const [diceResult, setDiceResult] = useState<number | null>(null);
  const [gameHistory, setGameHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [rollingAnimation, setRollingAnimation] = useState(false);

  useEffect(() => {
    loadWallet();
  }, []);

  const loadWallet = async () => {
    const result = await getGamingWallet();
    if (result.success && result.wallet) {
      setBalance(result.wallet.balance_cents);
    }
  };

  const rollDice = async () => {
    if (!prediction || bet > balance || bet < 3000) {
      alert('Invalid bet or prediction');
      return;
    }

    setLoading(true);
    setRollingAnimation(true);

    // Animate dice roll
    let animationFrame = 0;
    const rollInterval = setInterval(() => {
      setDiceResult(Math.floor(Math.random() * 100) + 1);
      animationFrame++;
      if (animationFrame > 20) clearInterval(rollInterval);
    }, 50);

    // Wait for animation
    setTimeout(async () => {
      clearInterval(rollInterval);
      setRollingAnimation(false);

      try {
        const result = await playDice(bet, prediction, targetNumber);

        if (result.success) {
          setBalance(result.wallet?.balance_cents || 0);
          const roll = result.game?.gameData.roll || 0;
          setDiceResult(roll);

          setGameHistory(prev => [
            {
              roll,
              prediction,
              target: targetNumber,
              result: 'loss',
              amount: bet,
              timestamp: new Date().toLocaleTimeString(),
            },
            ...prev.slice(0, 9),
          ]);

          setGameState('lost');
        }
      } finally {
        setLoading(false);
      }
    }, 1000);
  };

  const resetGame = () => {
    setGameState('idle');
    setDiceResult(null);
    setPrediction(null);
    setRollingAnimation(false);
  };

  const getWinOdds = () => {
    if (prediction === 'under') {
      return Math.round((targetNumber / 100) * 100);
    } else if (prediction === 'over') {
      return Math.round(((100 - targetNumber) / 100) * 100);
    }
    return 0;
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
              <h2 className="text-2xl font-bold text-white mb-4">Dice</h2>

              {/* Dice Display */}
              <div className="bg-slate-900 rounded-lg p-12 text-center mb-6">
                <p className="text-slate-400 text-sm mb-4">Roll Result</p>
                <div
                  className={`w-32 h-32 mx-auto bg-gradient-to-br from-purple-600 to-purple-700 rounded-lg flex items-center justify-center border-4 border-purple-400 transition-all ${
                    rollingAnimation ? 'scale-110' : 'scale-100'
                  }`}
                >
                  {diceResult && (
                    <p className="text-6xl font-bold text-white">{diceResult}</p>
                  )}
                  {!diceResult && <p className="text-slate-500 text-2xl">?</p>}
                </div>

                {/* Result Message */}
                {gameState === 'lost' && diceResult && (
                  <div className="mt-6 bg-red-500/20 border border-red-500 rounded-lg p-4">
                    <p className="text-red-400 font-bold">You Lost!</p>
                    <p className="text-red-300 text-sm mt-1">
                      Rolled {diceResult} - {prediction === 'over' ? 'Not over' : 'Not under'} {targetNumber}
                    </p>
                  </div>
                )}
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
                        onChange={e => setBet(parseInt(e.target.value) * 100 || 3000)}
                        min={30}
                        disabled={gameState === 'playing' || loading}
                        className="flex-1 bg-slate-700 border border-purple-500/30 rounded-lg px-4 py-2 text-white disabled:opacity-50"
                      />
                      <span className="text-slate-400">KES</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm text-slate-400 mb-2 block">Target Number</label>
                    <input
                      type="range"
                      min={1}
                      max={99}
                      value={targetNumber}
                      onChange={e => setTargetNumber(parseInt(e.target.value))}
                      disabled={loading}
                      className="w-full"
                    />
                    <p className="text-xs text-slate-400 mt-1 text-center">{targetNumber}</p>
                  </div>
                </div>

                {/* Quick Bet Buttons */}
                <div className="flex gap-2 flex-wrap">
                  {[30, 60, 90, 120, 500, 1000].map(amount => (
                    <button
                      key={amount}
                      onClick={() => setBet(amount * 100)}
                      disabled={loading || amount * 100 > balance}
                      className="px-3 py-1 bg-slate-700 hover:bg-slate-600 border border-purple-500/30 rounded-lg text-white text-sm disabled:opacity-50 transition-colors"
                    >
                      KES {amount}
                    </button>
                  ))}
                </div>

                {/* Prediction Buttons */}
                {gameState === 'idle' && (
                  <div className="grid grid-cols-2 gap-3 pt-4">
                    <button
                      onClick={() => setPrediction('under')}
                      className={`py-3 rounded-lg border font-bold transition-all ${
                        prediction === 'under'
                          ? 'bg-blue-600 border-blue-400 text-white'
                          : 'bg-slate-700 border-purple-500/30 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      Under {targetNumber}
                    </button>
                    <button
                      onClick={() => setPrediction('over')}
                      className={`py-3 rounded-lg border font-bold transition-all ${
                        prediction === 'over'
                          ? 'bg-orange-600 border-orange-400 text-white'
                          : 'bg-slate-700 border-purple-500/30 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      Over {targetNumber}
                    </button>
                  </div>
                )}

                {/* Roll Button */}
                {gameState === 'idle' && (
                  <button
                    onClick={rollDice}
                    disabled={!prediction || loading || balance < bet}
                    className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 text-white font-bold py-3 rounded-lg disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
                  >
                    {loading ? <Loader size={20} className="animate-spin" /> : <Play size={20} />}
                    {loading ? 'Rolling...' : 'Roll Dice'}
                  </button>
                )}

                {/* Try Again Button */}
                {gameState === 'lost' && (
                  <button
                    onClick={resetGame}
                    className="w-full bg-slate-700 hover:bg-slate-600 border border-purple-500/30 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
                  >
                    <RotateCcw size={20} />
                    Try Again
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Odds Info */}
            {prediction && (
              <div className="bg-slate-800/50 border border-purple-500/30 rounded-xl p-6">
                <h3 className="text-lg font-bold text-white mb-4">Odds</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-slate-400">Your Prediction:</p>
                    <p className="text-white font-bold capitalize">
                      {prediction === 'under' ? `< ${targetNumber}` : `> ${targetNumber}`}
                    </p>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-slate-400">Win Probability:</p>
                    <p className="text-purple-400 font-bold">{getWinOdds()}%</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-slate-400">Potential Payout:</p>
                    <p className="text-green-400 font-bold">KES {Math.round((bet / 100) * 1.98).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Game History */}
            <div className="bg-slate-800/50 border border-purple-500/30 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">Recent Games</h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {gameHistory.length === 0 ? (
                  <p className="text-slate-400 text-sm">No games yet</p>
                ) : (
                  gameHistory.map((game, i) => (
                    <div key={i} className="flex items-center justify-between bg-slate-700/50 p-3 rounded-lg border border-slate-600/50">
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-white">Rolled {game.roll}</p>
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
    </div>
  );
}
