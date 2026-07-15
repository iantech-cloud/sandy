'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Wallet, Play, RotateCcw, Volume2, VolumeX, Loader } from 'lucide-react';
import Link from 'next/link';
import { playCrash, getGamingWallet } from '@/app/actions/gaming-games';

interface GameState {
  status: 'idle' | 'playing' | 'crashed' | 'lost';
  multiplier: number;
  crashed: boolean;
  betPlaced: boolean;
}

export default function CrashGame() {
  const router = useRouter();
  const { data: session } = useSession();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [bet, setBet] = useState(3000); // 30 KES in cents
  const [gameState, setGameState] = useState<GameState>({
    status: 'idle',
    multiplier: 1.0,
    crashed: false,
    betPlaced: false,
  });
  const [balance, setBalance] = useState(0);
  const [gameHistory, setGameHistory] = useState<{ multiplier: number; result: 'loss'; amount: number; timestamp: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const gameLoopRef = useRef<any>(null);

  // Load wallet on mount
  useEffect(() => {
    loadWallet();
  }, []);

  const loadWallet = async () => {
    const result = await getGamingWallet();
    if (result.success && result.wallet) {
      setBalance(result.wallet.balance_cents);
    }
  };

  // Animate crash multiplier
  useEffect(() => {
    if (gameState.status !== 'playing') return;

    let multiplier = 1.0;
    let crashPoint = Math.random() * 2 + 1; // 1x to 3x
    let crashed = false;

    const interval = setInterval(() => {
      multiplier *= 1.08; // Exponential growth

      if (multiplier >= crashPoint && !crashed) {
        crashed = true;
        clearInterval(interval);
        setGameState(prev => ({
          ...prev,
          crashed: true,
          status: 'crashed',
        }));
        playSound('crash');
      } else {
        setGameState(prev => ({
          ...prev,
          multiplier: parseFloat(multiplier.toFixed(2)),
        }));
      }
    }, 100);

    return () => clearInterval(interval);
  }, [gameState.status]);

  // Draw canvas
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      // Clear
      ctx.fillStyle = 'rgba(15, 23, 42, 0.1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Grid
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.1)';
      ctx.lineWidth = 1;
      for (let i = 0; i < canvas.width; i += 40) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, canvas.height);
        ctx.stroke();
      }

      // Curve
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = 0; x < canvas.width; x += 5) {
        const progress = x / canvas.width;
        const y = canvas.height - Math.pow(1.08, progress * 100) * 20;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Plane
      const planeX = (gameState.multiplier / 10) * canvas.width;
      const planeY = canvas.height - gameState.multiplier * 20;

      ctx.fillStyle = gameState.crashed ? '#ef4444' : '#3b82f6';
      ctx.beginPath();
      ctx.arc(planeX, planeY, 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = gameState.crashed ? '#fca5a5' : '#a78bfa';
      ctx.font = 'bold 24px Arial';
      ctx.fillText(gameState.multiplier.toFixed(2) + 'x', planeX + 20, planeY - 10);
    };

    draw();
  }, [gameState.multiplier, gameState.crashed]);

  const playSound = (type: string) => {
    if (!soundEnabled) return;
    // Sound would play here
  };

  const startGame = async () => {
    if (bet > balance) {
      alert('Insufficient balance');
      return;
    }
    if (bet < 3000) {
      alert('Minimum bet is KES 30');
      return;
    }

    setLoading(true);
    try {
      // Simulate game play
      setGameState({
        status: 'playing',
        multiplier: 1.0,
        crashed: false,
        betPlaced: true,
      });

      // Wait for crash animation
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Call backend
      const result = await playCrash(bet, 2.0);

      if (result.success) {
        setBalance(result.wallet?.balance_cents || 0);
        setGameHistory(prev => [
          {
            multiplier: result.game?.gameData.crashPoint || 0,
            result: 'loss',
            amount: bet,
            timestamp: new Date().toLocaleTimeString(),
          },
          ...prev.slice(0, 9),
        ]);
        playSound('loss');
      } else {
        alert(result.error);
      }
    } finally {
      setLoading(false);
      setGameState(prev => ({ ...prev, status: 'idle' }));
    }
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
            <div className="bg-slate-800/50 border border-purple-500/30 rounded-xl p-6 mb-6">
              <h2 className="text-2xl font-bold text-white mb-4">Crash Game</h2>

              {/* Canvas */}
              <canvas
                ref={canvasRef}
                width={500}
                height={300}
                className="w-full bg-slate-900 rounded-lg border border-purple-500/20 mb-6"
              />

              {/* Game Status */}
              <div className="text-center mb-6">
                {gameState.status === 'playing' && (
                  <p className="text-4xl font-bold text-green-400">Watch the multiplier!</p>
                )}
                {gameState.status === 'crashed' && (
                  <div className="bg-red-500/20 border border-red-500 rounded-lg p-4">
                    <p className="text-4xl font-bold text-red-400">CRASHED!</p>
                    <p className="text-red-300 mt-2">You lost KES {(bet / 100).toLocaleString()}</p>
                  </div>
                )}
              </div>

              {/* Controls */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={bet / 100}
                    onChange={e => setBet(parseInt(e.target.value) * 100 || 3000)}
                    min={30}
                    disabled={gameState.status === 'playing' || loading}
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
                      disabled={gameState.status === 'playing' || amount * 100 > balance || loading}
                      className="px-3 py-1 bg-slate-700 hover:bg-slate-600 border border-purple-500/30 rounded-lg text-white text-sm disabled:opacity-50 transition-colors"
                    >
                      KES {amount}
                    </button>
                  ))}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={startGame}
                    disabled={gameState.status === 'playing' || loading || balance < bet}
                    className="flex-1 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 text-white font-bold py-3 rounded-lg disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
                  >
                    {loading ? <Loader size={20} className="animate-spin" /> : <Play size={20} />}
                    {loading ? 'Playing...' : 'Play'}
                  </button>

                  {gameState.status === 'crashed' && (
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
          <div className="space-y-6">
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
                        <p className="text-sm font-semibold text-white">{game.multiplier.toFixed(2)}x</p>
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

            {/* Settings */}
            <div className="bg-slate-800/50 border border-purple-500/30 rounded-xl p-6">
              <div className="flex items-center justify-between">
                <p className="text-white font-semibold">Sound</p>
                <button
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                >
                  {soundEnabled ? (
                    <Volume2 size={20} className="text-purple-400" />
                  ) : (
                    <VolumeX size={20} className="text-slate-400" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
