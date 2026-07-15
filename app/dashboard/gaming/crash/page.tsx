'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Wallet, Play, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import Link from 'next/link';

interface GameState {
  status: 'idle' | 'playing' | 'crashed' | 'won';
  multiplier: number;
  crashed: boolean;
  betPlaced: boolean;
}

export default function CrashGame() {
  const router = useRouter();
  const { data: session } = useSession();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [bet, setBet] = useState(100);
  const [gameState, setGameState] = useState<GameState>({
    status: 'idle',
    multiplier: 1.0,
    crashed: false,
    betPlaced: false,
  });
  const [cashOutMultiplier, setCashOutMultiplier] = useState(2.0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [balance, setBalance] = useState(10000);
  const [gameHistory, setGameHistory] = useState<{ multiplier: number; won: boolean; amount: number }[]>([]);

  // Draw animated plane on canvas
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      // Clear canvas
      ctx.fillStyle = 'rgba(15, 23, 42, 0.1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw grid
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.1)';
      ctx.lineWidth = 1;
      for (let i = 0; i < canvas.width; i += 40) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, canvas.height);
        ctx.stroke();
      }

      // Draw multiplier curve
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      const maxX = canvas.width;
      const maxY = canvas.height;
      
      for (let x = 0; x < maxX; x += 5) {
        const progress = x / maxX;
        const multiplier = Math.pow(1.05, progress * 100);
        const y = maxY - (multiplier - 1) * (maxY / 10);
        
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Draw plane
      const planeProgress = gameState.multiplier / 10;
      const planeX = Math.min(planeProgress * canvas.width, canvas.width - 40);
      const planeY = canvas.height - (gameState.multiplier - 1) * (canvas.height / 10);

      // Plane icon
      ctx.fillStyle = gameState.crashed ? '#ef4444' : '#3b82f6';
      ctx.beginPath();
      ctx.arc(planeX, planeY, 8, 0, Math.PI * 2);
      ctx.fill();

      // Draw multiplier text
      ctx.fillStyle = gameState.crashed ? '#fca5a5' : '#a78bfa';
      ctx.font = 'bold 24px Arial';
      ctx.fillText(gameState.multiplier.toFixed(2) + 'x', planeX + 20, planeY - 10);
    };

    draw();
  }, [gameState.multiplier, gameState.crashed]);

  const startGame = () => {
    if (bet > balance) return;
    if (bet < 30) return;

    setGameState({
      status: 'playing',
      multiplier: 1.0,
      crashed: false,
      betPlaced: true,
    });

    const startTime = Date.now();
    const crashTime = Math.random() * 10000 + 5000; // 5-15 seconds

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const newMultiplier = 1 + (elapsed / 1000) * 0.1;

      if (elapsed > crashTime) {
        setGameState((prev) => ({
          ...prev,
          status: 'crashed',
          crashed: true,
          multiplier: newMultiplier,
        }));
        clearInterval(interval);
        setBalance((prev) => prev - bet);
      } else {
        setGameState((prev) => ({
          ...prev,
          multiplier: newMultiplier,
        }));
      }
    }, 50);
  };

  const cashOut = () => {
    if (gameState.status !== 'playing') return;

    const winnings = Math.floor(bet * gameState.multiplier);
    setGameState({
      status: 'won',
      multiplier: gameState.multiplier,
      crashed: false,
      betPlaced: false,
    });

    setBalance((prev) => prev + winnings);
    setGameHistory((prev) => [
      { multiplier: gameState.multiplier, won: true, amount: winnings },
      ...prev.slice(0, 9),
    ]);
  };

  const resetGame = () => {
    setGameState({
      status: 'idle',
      multiplier: 1.0,
      crashed: false,
      betPlaced: false,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <Link href="/dashboard/gaming" className="flex items-center gap-2 text-purple-400 hover:text-purple-300 mb-6 w-fit">
          <ArrowLeft size={20} />
          Back to Gaming
        </Link>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Crash Game</h1>
            <p className="text-gray-400">Watch the multiplier and cash out before it crashes!</p>
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
          {/* Game Canvas */}
          <div className="lg:col-span-2">
            <div className="bg-slate-800/80 border border-purple-500/30 rounded-2xl p-6 mb-6">
              <div className="relative bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl overflow-hidden mb-4 h-80">
                <canvas
                  ref={canvasRef}
                  width={600}
                  height={320}
                  className="w-full h-full"
                />
                {gameState.status === 'crashed' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur">
                    <div className="text-center">
                      <p className="text-4xl font-bold text-red-400 mb-2">CRASHED!</p>
                      <p className="text-xl text-gray-300">Game Over</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Game Controls */}
              <div className="space-y-4">
                {/* Bet Amount */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Bet Amount (KES)</label>
                  <input
                    type="number"
                    value={bet}
                    onChange={(e) => setBet(Math.max(30, Number(e.target.value)))}
                    disabled={gameState.status === 'playing'}
                    className="w-full bg-slate-700 border border-purple-500/30 rounded-lg px-4 py-2 text-white disabled:opacity-50"
                    min="30"
                  />
                </div>

                {/* Quick Bet Buttons */}
                <div className="flex gap-2 flex-wrap">
                  {[30, 100, 500, 1000, 5000].map((amount) => (
                    <button
                      key={amount}
                      onClick={() => setBet(amount)}
                      disabled={gameState.status === 'playing'}
                      className="px-3 py-1 bg-slate-700 hover:bg-slate-600 border border-purple-500/30 rounded-lg text-white text-sm disabled:opacity-50 transition-colors"
                    >
                      KES {amount}
                    </button>
                  ))}
                </div>

                {/* Cash Out Multiplier */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Auto Cash Out at ({cashOutMultiplier.toFixed(2)}x)</label>
                  <input
                    type="range"
                    min="1.1"
                    max="10"
                    step="0.1"
                    value={cashOutMultiplier}
                    onChange={(e) => setCashOutMultiplier(Number(e.target.value))}
                    disabled={gameState.status === 'playing'}
                    className="w-full disabled:opacity-50"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  {gameState.status === 'idle' && (
                    <button
                      onClick={startGame}
                      disabled={bet > balance || bet < 30}
                      className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:bg-gray-600 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all"
                    >
                      <Play size={20} />
                      Start Game
                    </button>
                  )}
                  {gameState.status === 'playing' && (
                    <button
                      onClick={cashOut}
                      className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all animate-pulse"
                    >
                      Cash Out at {gameState.multiplier.toFixed(2)}x
                    </button>
                  )}
                  {(gameState.status === 'crashed' || gameState.status === 'won') && (
                    <button
                      onClick={resetGame}
                      className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all"
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
          <div className="space-y-6">
            {/* Stats */}
            <div className="bg-slate-800/80 border border-purple-500/30 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">Stats</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Current Multiplier:</span>
                  <span className="text-purple-400 font-bold">{gameState.multiplier.toFixed(2)}x</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Min Bet:</span>
                  <span className="text-white font-bold">KES 30</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Max Bet:</span>
                  <span className="text-white font-bold">KES 500,000</span>
                </div>
              </div>
            </div>

            {/* Game History */}
            <div className="bg-slate-800/80 border border-purple-500/30 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">Recent Games</h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {gameHistory.length === 0 ? (
                  <p className="text-gray-400 text-sm">No games played yet</p>
                ) : (
                  gameHistory.map((game, idx) => (
                    <div key={idx} className={`p-2 rounded text-sm ${game.won ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                      {game.multiplier.toFixed(2)}x - {game.won ? '+' : '-'}KES {game.amount}
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
