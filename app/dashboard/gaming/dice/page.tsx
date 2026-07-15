'use client';

import { useState } from 'react';
import { ArrowLeft, Wallet, Play, RotateCcw } from 'lucide-react';
import Link from 'next/link';

export default function DiceGame() {
  const [bet, setBet] = useState(30);
  const [balance, setBalance] = useState(10000);
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'won' | 'lost'>('idle');
  const [prediction, setPrediction] = useState<'under' | 'over' | null>(null);
  const [targetNumber, setTargetNumber] = useState(50);
  const [diceResult, setDiceResult] = useState<number | null>(null);
  const [multiplier, setMultiplier] = useState(0);
  const [gameHistory, setGameHistory] = useState<{ result: number; won: boolean; amount: number }[]>([]);

  const rollDice = () => {
    if (!prediction || bet > balance || bet < 30) return;

    const result = Math.floor(Math.random() * 100) + 1;
    setDiceResult(result);
    
    const isWon = 
      (prediction === 'under' && result < targetNumber) ||
      (prediction === 'over' && result > targetNumber);

    setMultiplier(isWon ? 1.98 : 0);

    if (isWon) {
      const winnings = Math.floor(bet * 1.98);
      setGameState('won');
      setBalance((prev) => prev + winnings);
      setGameHistory((prev) => [{ result, won: true, amount: winnings }, ...prev.slice(0, 9)]);
    } else {
      setGameState('lost');
      setBalance((prev) => prev - bet);
      setGameHistory((prev) => [{ result, won: false, amount: bet }, ...prev.slice(0, 9)]);
    }
  };

  const resetGame = () => {
    setGameState('idle');
    setDiceResult(null);
    setPrediction(null);
    setMultiplier(0);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        <Link href="/dashboard/gaming" className="flex items-center gap-2 text-purple-400 hover:text-purple-300 mb-6 w-fit">
          <ArrowLeft size={20} />
          Back to Gaming
        </Link>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Dice</h1>
            <p className="text-gray-400">Predict if the dice will be over or under your target</p>
          </div>
          <div className="flex items-center gap-3 bg-slate-800/80 border border-purple-500/30 rounded-xl p-4">
            <Wallet size={24} className="text-purple-400" />
            <div>
              <p className="text-sm text-gray-400">Balance</p>
              <p className="text-2xl font-bold text-white">KES {balance.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-slate-800/80 border border-purple-500/30 rounded-2xl p-6">
            {/* Dice Display */}
            <div className="mb-8">
              <div className="flex flex-col items-center mb-8">
                <p className="text-sm text-gray-400 mb-4">Dice Result</p>
                <div className="w-32 h-32 rounded-2xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-6xl font-bold text-white mb-4">
                  {diceResult !== null ? diceResult : '?'}
                </div>
                {diceResult !== null && (
                  <div className={`text-2xl font-bold ${(gameState === 'won') ? 'text-green-400' : 'text-red-400'}`}>
                    {gameState === 'won' ? '✓ WIN!' : '✗ LOSE'}
                  </div>
                )}
              </div>

              {/* Game Controls */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Bet Amount (KES)</label>
                  <input
                    type="number"
                    value={bet}
                    onChange={(e) => setBet(Math.max(30, Number(e.target.value)))}
                    disabled={gameState === 'playing'}
                    className="w-full bg-slate-700 border border-purple-500/30 rounded-lg px-4 py-2 text-white disabled:opacity-50"
                    min="30"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">Target Number: {targetNumber}</label>
                  <input
                    type="range"
                    min="2"
                    max="98"
                    value={targetNumber}
                    onChange={(e) => setTargetNumber(Number(e.target.value))}
                    disabled={gameState !== 'idle'}
                    className="w-full disabled:opacity-50"
                  />
                </div>

                {gameState === 'idle' && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        setPrediction('under');
                        setGameState('playing');
                        setTimeout(() => rollDice(), 100);
                      }}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2"
                    >
                      <Play size={20} />
                      Under {targetNumber}
                    </button>
                    <button
                      onClick={() => {
                        setPrediction('over');
                        setGameState('playing');
                        setTimeout(() => rollDice(), 100);
                      }}
                      className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2"
                    >
                      <Play size={20} />
                      Over {targetNumber}
                    </button>
                  </div>
                )}

                {(gameState === 'won' || gameState === 'lost') && (
                  <button
                    onClick={resetGame}
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2"
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
            <div className="bg-slate-800/80 border border-purple-500/30 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">Game Stats</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Status:</span>
                  <span className={`font-bold ${gameState === 'playing' ? 'text-yellow-400' : gameState === 'won' ? 'text-green-400' : gameState === 'lost' ? 'text-red-400' : 'text-gray-400'}`}>
                    {gameState.toUpperCase()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Prediction:</span>
                  <span className="text-white font-bold">{prediction?.toUpperCase() || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Win Rate:</span>
                  <span className="text-purple-400 font-bold">50%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Odds:</span>
                  <span className="text-white font-bold">1.98x</span>
                </div>
              </div>
            </div>

            {/* Game History */}
            <div className="bg-slate-800/80 border border-purple-500/30 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">Recent Rolls</h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {gameHistory.length === 0 ? (
                  <p className="text-gray-400 text-sm">No rolls yet</p>
                ) : (
                  gameHistory.map((game, idx) => (
                    <div key={idx} className={`p-2 rounded text-sm flex justify-between ${game.won ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                      <span>Roll: {game.result}</span>
                      <span>{game.won ? '+' : '-'}KES {game.amount}</span>
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
