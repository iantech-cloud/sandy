'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { ArrowLeft, Wallet, RotateCcw, AlertCircle, Zap } from 'lucide-react';
import Link from 'next/link';
import { playDice, getGamingWallet } from '@/app/actions/gaming-games';

export default function DiceGame() {
  const { data: session } = useSession();
  const diceRef = useRef<HTMLCanvasElement>(null);

  const [bet, setBet] = useState(50000);
  const [prediction, setPrediction] = useState<'over' | 'under'>('over');
  const [targetNumber, setTargetNumber] = useState(50);
  const [balance, setBalance] = useState(0);
  const [gameState, setGameState] = useState<'setup' | 'rolling' | 'done'>('setup');
  const [diceResult, setDiceResult] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ won: boolean; amount: number; multiplier: number; rolled: number } | null>(null);
  const [history, setHistory] = useState<{ rolled: number; prediction: string; multiplier: number; result: 'win' | 'lose' }[]>([]);

  const MIN_BET = 3000;
  const MAX_BET = 7000000; // 70,000 KES

  useEffect(() => {
    if (session?.user?.id) {
      fetchBalance();
    }
  }, [session]);

  useEffect(() => {
    drawDice();
  }, [diceResult]);

  const fetchBalance = async () => {
    try {
      const response = await fetch('/api/gaming/wallet');
      const data = await response.json();
      setBalance(data.balance_cents || 0);
    } catch (err) {
      console.error('Failed to fetch balance:', err);
    }
  };

  // Calculate win probability and multiplier
  const calculateOdds = () => {
    let winningCases = 0;
    if (prediction === 'over') {
      winningCases = Math.max(0, 99 - targetNumber);
    } else {
      winningCases = Math.max(1, targetNumber);
    }
    const probability = winningCases / 100;
    const multiplier = probability > 0 ? 0.98 / probability : 0;
    return { probability: (probability * 100).toFixed(2), multiplier: multiplier.toFixed(2) };
  };

  const drawDice = () => {
    const canvas = diceRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw dice cube (isometric view)
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const size = 60;

    // Draw cube faces with some 3D perspective
    ctx.save();
    ctx.translate(centerX, centerY);

    // Front face
    ctx.fillStyle = '#a78bfa';
    ctx.fillRect(-size, -size, size * 2, size * 2);
    ctx.strokeStyle = '#7c3aed';
    ctx.lineWidth = 3;
    ctx.strokeRect(-size, -size, size * 2, size * 2);

    // Top face
    ctx.fillStyle = '#c4b5fd';
    ctx.beginPath();
    ctx.moveTo(-size, -size);
    ctx.lineTo(-size - 20, -size - 20);
    ctx.lineTo(size - 20, -size - 20);
    ctx.lineTo(size, -size);
    ctx.fill();
    ctx.stroke();

    // Right face
    ctx.fillStyle = '#9370db';
    ctx.beginPath();
    ctx.moveTo(size, -size);
    ctx.lineTo(size + 20, -size - 20);
    ctx.lineTo(size + 20, size - 20);
    ctx.lineTo(size, size);
    ctx.fill();
    ctx.stroke();

    // Draw dice number
    if (diceResult !== null) {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 120px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(diceResult.toString(), 0, 0);
    } else {
      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 80px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', 0, 0);
    }

    ctx.restore();
  };

  const rollDice = async () => {
    setError(null);

    if (!prediction) {
      setError('Please select Over or Under');
      return;
    }

    if (bet < MIN_BET) {
      setError(`Minimum bet is KES ${MIN_BET / 100}`);
      return;
    }

    if (bet > MAX_BET) {
      setError(`Maximum bet is KES ${MAX_BET / 100}`);
      return;
    }

    if (bet > balance) {
      setError(`Insufficient balance. You need KES ${(bet - balance) / 100} more`);
      return;
    }

    setLoading(true);
    setBalance(prev => prev - bet);
    setGameState('rolling');
    setDiceResult(null);

    // Simulate dice roll
    for (let i = 0; i < 20; i++) {
      await new Promise(resolve => setTimeout(resolve, 50));
      setDiceResult(Math.floor(Math.random() * 100));
    }

    // Generate result
    const rolled = Math.floor(Math.random() * 100);
    setDiceResult(rolled);

    // Check if won
    let won = false;
    if (prediction === 'over') {
      won = rolled > targetNumber;
    } else {
      won = rolled < targetNumber;
    }

    const odds = calculateOdds();
    const multiplier = parseFloat(odds.multiplier);
    const winAmount = Math.floor(bet * multiplier);

    if (won) {
      setBalance(prev => prev + winAmount);
    }

    setResult({
      won,
      amount: won ? winAmount : 0,
      multiplier,
      rolled,
    });

    setGameState('done');
    setHistory(prev => [
      {
        rolled,
        prediction,
        multiplier,
        result: won ? 'win' : 'lose',
      },
      ...prev.slice(0, 19),
    ]);

    try {
      await playDice(bet, targetNumber, prediction === 'over');
    } catch (err) {
      console.error('Failed to record game:', err);
    }

    setLoading(false);
  };

  const playAgain = () => {
    setGameState('setup');
    setDiceResult(null);
    setResult(null);
    fetchBalance();
  };

  const odds = calculateOdds();

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-800/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/gaming" className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
              <ArrowLeft size={20} className="text-gray-400" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-white">Dice</h1>
              <p className="text-sm text-gray-400">Roll under or over a target</p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-slate-800 px-4 py-2 rounded-lg border border-purple-500/30">
            <Wallet size={20} className="text-purple-400" />
            <div>
              <p className="text-xs text-slate-400">Balance</p>
              <p className="text-lg font-bold text-white">KES {(balance / 100).toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Game Area */}
          <div className="lg:col-span-2">
            {error && (
              <div className="mb-6 bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="text-red-400 flex-shrink-0 mt-0.5" size={20} />
                <p className="text-red-400 font-semibold text-sm">{error}</p>
              </div>
            )}

            {/* Dice Display */}
            <div className="bg-slate-800/50 border border-purple-500/30 rounded-xl p-8 mb-6">
              <canvas
                ref={diceRef}
                width={400}
                height={300}
                className="w-full bg-slate-900 rounded-lg"
              />
            </div>

            {/* Prediction Display */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className={`p-6 rounded-lg border-2 transition-all ${
                prediction === 'under'
                  ? 'bg-blue-500/10 border-blue-500'
                  : 'bg-slate-700/50 border-slate-600'
              }`}>
                <p className="text-gray-400 text-sm mb-2">Prediction</p>
                <p className={`text-2xl font-bold ${prediction === 'under' ? 'text-blue-400' : 'text-gray-300'}`}>
                  Under {targetNumber}
                </p>
              </div>
              <div className={`p-6 rounded-lg border-2 transition-all ${
                prediction === 'over'
                  ? 'bg-orange-500/10 border-orange-500'
                  : 'bg-slate-700/50 border-slate-600'
              }`}>
                <p className="text-gray-400 text-sm mb-2">Prediction</p>
                <p className={`text-2xl font-bold ${prediction === 'over' ? 'text-orange-400' : 'text-gray-300'}`}>
                  Over {targetNumber}
                </p>
              </div>
            </div>

            {/* Odds Display */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                <p className="text-gray-400 text-xs mb-2">Win Chance</p>
                <p className="text-white font-bold text-2xl">{odds.probability}%</p>
              </div>
              <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                <p className="text-gray-400 text-xs mb-2">Payout Multiplier</p>
                <p className="text-green-400 font-bold text-2xl">{odds.multiplier}x</p>
              </div>
            </div>

            {/* Result */}
            {result && (
              <div className={`p-6 rounded-lg border mb-6 ${
                result.won ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'
              }`}>
                <p className={`text-sm font-semibold mb-2 ${result.won ? 'text-green-400' : 'text-red-400'}`}>
                  {result.won ? 'YOU WIN!' : 'YOU LOSE!'}
                </p>
                <p className={`text-3xl font-bold mb-2 ${result.won ? 'text-green-400' : 'text-red-400'}`}>
                  {result.won ? '+' : ''}KES {(result.amount / 100).toLocaleString()}
                </p>
                <p className="text-gray-400 text-sm">
                  Rolled: {result.rolled} ({result.prediction === 'over' ? 'Over' : 'Under'} {targetNumber})
                </p>
              </div>
            )}
          </div>

          {/* Sidebar - Controls */}
          <div className="space-y-6">
            {/* Controls */}
            <div className="bg-slate-800/50 border border-purple-500/30 rounded-xl p-6">
              <h2 className="text-lg font-bold text-white mb-4">Game Control</h2>

              <div className="space-y-4">
                {/* Bet Amount */}
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">Bet Amount (KES)</label>
                  <input
                    type="number"
                    value={bet / 100}
                    onChange={(e) => setBet(Math.max(30, parseInt(e.target.value) || 30) * 100)}
                    disabled={gameState !== 'setup'}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:border-purple-500 focus:outline-none disabled:opacity-50"
                  />
                </div>

                {/* Target Number Slider */}
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">Target Number: {targetNumber}</label>
                  <input
                    type="range"
                    min="1"
                    max="99"
                    value={targetNumber}
                    onChange={(e) => setTargetNumber(parseInt(e.target.value))}
                    disabled={gameState !== 'setup'}
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>1</span>
                    <span>50</span>
                    <span>99</span>
                  </div>
                </div>

                {/* Prediction Buttons */}
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">Choose Prediction</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setPrediction('under')}
                      disabled={gameState !== 'setup'}
                      className={`py-2 px-3 rounded-lg font-semibold text-sm transition-all ${
                        prediction === 'under'
                          ? 'bg-blue-600 text-white border border-blue-400'
                          : 'bg-slate-700 text-gray-300 border border-slate-600 hover:border-blue-500'
                      } disabled:opacity-50`}
                    >
                      Under
                    </button>
                    <button
                      onClick={() => setPrediction('over')}
                      disabled={gameState !== 'setup'}
                      className={`py-2 px-3 rounded-lg font-semibold text-sm transition-all ${
                        prediction === 'over'
                          ? 'bg-orange-600 text-white border border-orange-400'
                          : 'bg-slate-700 text-gray-300 border border-slate-600 hover:border-orange-500'
                      } disabled:opacity-50`}
                    >
                      Over
                    </button>
                  </div>
                </div>

                {/* Quick Bets */}
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">Quick Bets</label>
                  <div className="flex gap-2 flex-wrap">
                    {[100, 500, 1000, 5000].map(amount => (
                      <button
                        key={amount}
                        onClick={() => setBet(amount * 100)}
                        disabled={gameState !== 'setup' || amount * 100 > balance}
                        className="px-3 py-1 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-lg text-white text-xs disabled:opacity-50 transition-colors"
                      >
                        KES {amount}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="pt-4 space-y-2">
                  {gameState === 'setup' && (
                    <button
                      onClick={rollDice}
                      disabled={loading}
                      className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-3 rounded-lg disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                    >
                      <Zap size={20} />
                      Roll Dice
                    </button>
                  )}

                  {gameState !== 'setup' && (
                    <button
                      onClick={playAgain}
                      className="w-full bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-500 hover:to-slate-600 text-white font-bold py-3 rounded-lg transition-all flex items-center justify-center gap-2"
                    >
                      <RotateCcw size={20} />
                      Play Again
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Recent History */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
              <h3 className="text-sm font-bold text-white mb-3">Recent Rolls</h3>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {history.length === 0 ? (
                  <p className="text-gray-400 text-sm">No games yet</p>
                ) : (
                  history.map((game, i) => (
                    <div key={i} className={`p-3 rounded-lg border ${
                      game.result === 'win' ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'
                    }`}>
                      <div className="flex items-center justify-between mb-1">
                        <p className={`text-xs font-semibold ${game.result === 'win' ? 'text-green-400' : 'text-red-400'}`}>
                          {game.result === 'win' ? 'WIN' : 'LOSE'} - Rolled {game.rolled}
                        </p>
                      </div>
                      <p className="text-xs text-gray-400">
                        {game.prediction === 'over' ? 'Over' : 'Under'} • {game.multiplier.toFixed(2)}x
                      </p>
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
