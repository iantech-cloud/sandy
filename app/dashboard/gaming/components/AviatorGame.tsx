'use client';

import { useState, useEffect, useRef } from 'react';
import { Plane, TrendingUp, DollarSign, X, Volume2, VolumeX, RotateCcw } from 'lucide-react';

interface AviatorGameProps {
  onClose: () => void;
}

type GameState = 'idle' | 'playing' | 'crashed' | 'won';

export default function AviatorGame({ onClose }: AviatorGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<GameState>('idle');
  const [currentMultiplier, setCurrentMultiplier] = useState(1.0);
  const [betAmount, setBetAmount] = useState('100');
  const [balance, setBalance] = useState(50000);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [history, setHistory] = useState<number[]>([1.0, 1.2, 2.5, 1.8, 3.2, 1.5, 4.1, 1.3]);
  const [planeX, setPlaneX] = useState(0);
  const [planeY, setPlaneY] = useState(400);
  const gameLoopRef = useRef<NodeJS.Timeout | null>(null);
  const multiplierRef = useRef(1.0);

  // Draw canvas game
  useEffect(() => {
    if (!canvasRef.current || gameState === 'idle') return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.fillStyle = 'linear-gradient(180deg, #0f172a 0%, #1e1b4b 100%)';
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#0f172a');
    gradient.addColorStop(1, '#1e1b4b');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Draw ground
    ctx.fillStyle = '#4c1d95';
    ctx.fillRect(0, height - 60, width, 60);

    // Draw plane
    const planeSize = 40;
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath();
    // Plane triangle
    ctx.moveTo(planeX, planeY);
    ctx.lineTo(planeX - planeSize, planeY + planeSize);
    ctx.lineTo(planeX + planeSize, planeY + planeSize);
    ctx.closePath();
    ctx.fill();

    // Draw plane trail
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(planeX, planeY + planeSize);
    ctx.lineTo(planeX, height - 60);
    ctx.stroke();

    // Draw multiplier text
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`${currentMultiplier.toFixed(2)}x`, planeX, planeY - 20);
  }, [planeX, planeY, currentMultiplier, gameState]);

  // Game loop
  useEffect(() => {
    if (gameState !== 'playing') return;

    gameLoopRef.current = setInterval(() => {
      setPlaneX((prev) => {
        const newX = prev + 3;
        if (newX > 800) {
          setGameState('crashed');
          return prev;
        }
        return newX;
      });

      setPlaneY((prev) => {
        const newY = prev - 2;
        if (newY < 50) {
          setGameState('crashed');
          return prev;
        }
        return newY;
      });

      multiplierRef.current += 0.02;
      setCurrentMultiplier(Number(multiplierRef.current.toFixed(2)));

      // Random crash
      if (Math.random() < 0.005) {
        setGameState('crashed');
      }
    }, 50);

    return () => {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    };
  }, [gameState]);

  const handleBet = () => {
    const amount = parseInt(betAmount);
    if (amount > balance) {
      alert('Insufficient balance');
      return;
    }

    setGameState('playing');
    setCurrentMultiplier(1.0);
    multiplierRef.current = 1.0;
    setPlaneX(50);
    setPlaneY(400);
  };

  const handleCashOut = () => {
    if (gameState !== 'playing') return;

    setGameState('won');
    const winnings = parseInt(betAmount) * currentMultiplier;
    setBalance((prev) => prev - parseInt(betAmount) + winnings);
    setHistory((prev) => [currentMultiplier, ...prev.slice(0, 7)]);

    setTimeout(() => {
      setGameState('idle');
    }, 2000);
  };

  const handleReset = () => {
    setGameState('idle');
    setCurrentMultiplier(1.0);
    multiplierRef.current = 1.0;
    setPlaneX(0);
    setPlaneY(400);
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl max-h-[90vh] bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 border border-purple-500/30 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-purple-500/20">
          <div className="flex items-center gap-3">
            <Plane size={28} className="text-blue-400 animate-bounce" />
            <h2 className="text-2xl font-bold text-white">Aviator</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-slate-800 rounded-lg"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col lg:flex-row gap-4 p-6 overflow-hidden">
          {/* Game Canvas */}
          <div className="flex-1 flex flex-col gap-4">
            <div className="flex-1 bg-gradient-to-br from-slate-800 to-slate-900 border border-purple-500/20 rounded-xl overflow-hidden">
              <canvas
                ref={canvasRef}
                width={800}
                height={500}
                className="w-full h-full"
              />
            </div>

            {/* Game Status */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-800/50 border border-purple-500/20 rounded-lg p-4 text-center">
                <p className="text-gray-400 text-sm mb-1">Balance</p>
                <p className="text-2xl font-bold text-white">
                  KES {balance.toLocaleString()}
                </p>
              </div>
              <div className="bg-slate-800/50 border border-purple-500/20 rounded-lg p-4 text-center">
                <p className="text-gray-400 text-sm mb-1">Bet Amount</p>
                <p className="text-2xl font-bold text-purple-400">
                  KES {parseInt(betAmount).toLocaleString()}
                </p>
              </div>
              <div className="bg-slate-800/50 border border-purple-500/20 rounded-lg p-4 text-center">
                <p className="text-gray-400 text-sm mb-1">Potential Win</p>
                <p className="text-2xl font-bold text-green-400">
                  KES {(parseInt(betAmount) * currentMultiplier).toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* Sidebar Controls */}
          <div className="w-full lg:w-80 flex flex-col gap-6">
            {/* Multiplier Display */}
            <div className="bg-gradient-to-br from-blue-600 to-cyan-500 rounded-2xl p-6 text-white text-center shadow-lg">
              <p className="text-blue-100 text-sm font-semibold mb-2 uppercase">Current Multiplier</p>
              <h3 className="text-5xl font-bold">{currentMultiplier.toFixed(2)}x</h3>
              {gameState === 'crashed' && (
                <p className="text-red-300 text-lg font-bold mt-3">CRASHED!</p>
              )}
              {gameState === 'won' && (
                <p className="text-green-300 text-lg font-bold mt-3">WON!</p>
              )}
            </div>

            {/* Bet Amount Input */}
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-3">Bet Amount (KES)</label>
              <input
                type="number"
                value={betAmount}
                onChange={(e) => setBetAmount(e.target.value)}
                disabled={gameState !== 'idle'}
                className="w-full px-4 py-3 bg-slate-800 border border-purple-500/30 rounded-lg text-white font-semibold focus:border-purple-500 focus:outline-none disabled:opacity-50"
                min="10"
                max={balance}
              />
              <p className="text-xs text-gray-400 mt-2">Min: 10 | Max: {balance.toLocaleString()}</p>
            </div>

            {/* Preset Amounts */}
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">Quick Select</label>
              <div className="grid grid-cols-3 gap-2">
                {[100, 500, 1000, 2000, 5000, 10000].map((preset) => (
                  <button
                    key={preset}
                    onClick={() => setBetAmount(preset.toString())}
                    disabled={gameState !== 'idle' || preset > balance}
                    className="py-2 px-2 text-xs font-semibold rounded-lg bg-slate-800 text-gray-300 border border-purple-500/20 hover:border-purple-500/50 disabled:opacity-30 transition-colors"
                  >
                    {preset >= 1000 ? `${preset / 1000}K` : preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              {gameState === 'idle' && (
                <button
                  onClick={handleBet}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-4 px-6 rounded-xl transition-all shadow-lg hover:shadow-purple-500/50 flex items-center justify-center gap-2"
                >
                  <DollarSign size={20} />
                  Place Bet
                </button>
              )}

              {gameState === 'playing' && (
                <button
                  onClick={handleCashOut}
                  className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold py-4 px-6 rounded-xl transition-all shadow-lg hover:shadow-green-500/50 flex items-center justify-center gap-2 animate-pulse"
                >
                  <TrendingUp size={20} />
                  Cash Out Now!
                </button>
              )}

              {(gameState === 'crashed' || gameState === 'won') && (
                <button
                  onClick={handleReset}
                  className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-4 px-6 rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  <RotateCcw size={20} />
                  Play Again
                </button>
              )}
            </div>

            {/* Recent History */}
            <div>
              <h4 className="text-sm font-semibold text-gray-300 mb-3">Recent History</h4>
              <div className="flex gap-2 flex-wrap">
                {history.map((mult, idx) => (
                  <div
                    key={idx}
                    className={`px-3 py-2 rounded-lg text-xs font-semibold ${
                      mult >= 2
                        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                        : 'bg-red-500/20 text-red-400 border border-red-500/30'
                    }`}
                  >
                    {mult.toFixed(2)}x
                  </div>
                ))}
              </div>
            </div>

            {/* Sound Toggle */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-slate-800 border border-purple-500/20 hover:border-purple-500/50 text-gray-300 rounded-lg transition-colors"
            >
              {soundEnabled ? (
                <>
                  <Volume2 size={18} />
                  Sound On
                </>
              ) : (
                <>
                  <VolumeX size={18} />
                  Sound Off
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
