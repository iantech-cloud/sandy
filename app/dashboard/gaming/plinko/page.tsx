'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Wallet, Play, RotateCcw, Loader } from 'lucide-react';
import Link from 'next/link';
import { playPlinko, getGamingWallet } from '@/app/actions/gaming-games';

export default function PlinkoGame() {
  const router = useRouter();
  const { data: session } = useSession();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [bet, setBet] = useState(3000);
  const [balance, setBalance] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [result, setResult] = useState<{ multiplier: number; landed: boolean } | null>(null);
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

  const startGame = async () => {
    if (bet > balance) {
      alert('Insufficient balance');
      return;
    }
    if (bet < 3000) {
      alert('Minimum bet is KES 30');
      return;
    }

    setIsPlaying(true);
    setLoading(true);

    try {
      const gameResult = await playPlinko(bet);

      if (gameResult.success) {
        setBalance(gameResult.wallet?.balance_cents || 0);
        const multiplier = gameResult.game?.gameData.multiplier || 0;

        setResult({ multiplier, landed: true });
        setGameHistory(prev => [
          {
            multiplier,
            result: 'loss',
            amount: bet,
            timestamp: new Date().toLocaleTimeString(),
          },
          ...prev.slice(0, 9),
        ]);

        // Animate ball drop
        animateBall(multiplier);
      }
    } finally {
      setLoading(false);
      setTimeout(() => setIsPlaying(false), 3000);
    }
  };

  const animateBall = (multiplier: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let ballY = 0;
    let ballX = canvas.width / 2;
    const ballRadius = 5;
    let landingIndex = Math.floor(multiplier * 2);

    const animate = () => {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw bins
      ctx.fillStyle = 'rgba(168, 85, 247, 0.3)';
      for (let i = 0; i < 10; i++) {
        const binWidth = canvas.width / 10;
        ctx.fillRect(i * binWidth, canvas.height - 50, binWidth, 50);
        ctx.strokeStyle = 'rgba(168, 85, 247, 0.5)';
        ctx.strokeRect(i * binWidth, canvas.height - 50, binWidth, 50);
      }

      // Draw ball
      ctx.fillStyle = '#3b82f6';
      ctx.beginPath();
      ctx.arc(ballX, ballY, ballRadius, 0, Math.PI * 2);
      ctx.fill();

      ballY += 5;
      ballX += (Math.random() - 0.5) * 8;

      if (ballY < canvas.height - 50) {
        requestAnimationFrame(animate);
      } else {
        // Ball landed
        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.arc(ballX, ballY, ballRadius, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    animate();
  };

  const resetGame = () => {
    setResult(null);
    setIsPlaying(false);
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
              <h2 className="text-2xl font-bold text-white mb-4">Plinko</h2>

              {/* Canvas */}
              <canvas
                ref={canvasRef}
                width={600}
                height={400}
                className="w-full bg-slate-900 rounded-lg border border-purple-500/20 mb-6"
              />

              {/* Result */}
              {result && (
                <div className="bg-red-500/20 border border-red-500 rounded-lg p-4 text-center mb-6">
                  <p className="text-red-400 text-lg font-bold mb-1">Game Over!</p>
                  <p className="text-red-300 font-bold">Multiplier: {result.multiplier.toFixed(2)}x</p>
                  <p className="text-red-300 mt-1">You lost KES {(bet / 100).toLocaleString()}</p>
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
                    disabled={isPlaying || loading}
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
                      disabled={isPlaying || amount * 100 > balance || loading}
                      className="px-3 py-1 bg-slate-700 hover:bg-slate-600 border border-purple-500/30 rounded-lg text-white text-sm disabled:opacity-50 transition-colors"
                    >
                      KES {amount}
                    </button>
                  ))}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                  {!result ? (
                    <button
                      onClick={startGame}
                      disabled={isPlaying || loading || balance < bet}
                      className="flex-1 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 text-white font-bold py-3 rounded-lg disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
                    >
                      {loading ? <Loader size={20} className="animate-spin" /> : <Play size={20} />}
                      {loading ? 'Playing...' : 'Play'}
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
        </div>
      </div>
    </div>
  );
}
