'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Wallet, Play, RotateCcw } from 'lucide-react';
import Link from 'next/link';

export default function PlinkoGame() {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [bet, setBet] = useState(100);
  const [balance, setBalance] = useState(10000);
  const [isPlaying, setIsPlaying] = useState(false);
  const [result, setResult] = useState<{ multiplier: number; won: boolean } | null>(null);

  useEffect(() => {
    if (!canvasRef.current || !isPlaying) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let ballY = 0;
    let ballX = canvas.width / 2;
    const ballRadius = 5;
    const pegs: { x: number; y: number }[] = [];

    // Create peg grid
    for (let row = 0; row < 10; row++) {
      for (let col = 0; col <= row; col++) {
        const x = (canvas.width / 11) * (col + (10 - row) / 2 + 0.5);
        const y = 50 + row * 40;
        pegs.push({ x, y });
      }
    }

    const animate = () => {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw pegs
      ctx.fillStyle = 'rgba(168, 85, 247, 0.5)';
      pegs.forEach((peg) => {
        ctx.beginPath();
        ctx.arc(peg.x, peg.y, 4, 0, Math.PI * 2);
        ctx.fill();
      });

      // Draw ball
      ctx.fillStyle = '#3b82f6';
      ctx.beginPath();
      ctx.arc(ballX, ballY, ballRadius, 0, Math.PI * 2);
      ctx.fill();

      // Physics
      if (ballY < canvas.height - 50) {
        ballY += 3;
        ballX += (Math.random() - 0.5) * 4;
        requestAnimationFrame(animate);
      } else {
        setIsPlaying(false);
        const multiplier = 1 + Math.random() * 4;
        const won = Math.random() > 0.3;
        setResult({ multiplier, won });
        
        if (won) {
          setBalance((prev) => prev + Math.floor(bet * multiplier));
        } else {
          setBalance((prev) => prev - bet);
        }
      }
    };

    animate();
  }, [isPlaying, bet]);

  const startGame = () => {
    if (bet > balance || bet < 30) return;
    setResult(null);
    setIsPlaying(true);
  };

  const resetGame = () => {
    setIsPlaying(false);
    setResult(null);
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
            <h1 className="text-4xl font-bold text-white mb-2">Plinko</h1>
            <p className="text-gray-400">Drop the ball and win based on where it lands!</p>
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
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl overflow-hidden mb-4 h-96">
              <canvas ref={canvasRef} width={500} height={400} className="w-full h-full" />
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Bet Amount (KES)</label>
                <input
                  type="number"
                  value={bet}
                  onChange={(e) => setBet(Math.max(30, Number(e.target.value)))}
                  disabled={isPlaying}
                  className="w-full bg-slate-700 border border-purple-500/30 rounded-lg px-4 py-2 text-white disabled:opacity-50"
                  min="30"
                />
              </div>

              {!isPlaying && !result && (
                <button
                  onClick={startGame}
                  disabled={bet > balance || bet < 30}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:bg-gray-600 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2"
                >
                  <Play size={20} />
                  Drop Ball
                </button>
              )}

              {result && (
                <div className="space-y-2">
                  <div className={`p-4 rounded-lg text-center ${result.won ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    <p className="text-2xl font-bold">{result.won ? '🎉 WIN!' : '❌ LOST'}</p>
                    <p className="text-sm">Multiplier: {result.multiplier.toFixed(2)}x</p>
                  </div>
                  <button
                    onClick={resetGame}
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2"
                  >
                    <RotateCcw size={20} />
                    Try Again
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="bg-slate-800/80 border border-purple-500/30 rounded-2xl p-6">
            <h3 className="text-lg font-bold text-white mb-4">Game Info</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Min Bet:</span>
                <span className="text-white font-bold">KES 30</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Max Bet:</span>
                <span className="text-white font-bold">KES 500,000</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Max Win:</span>
                <span className="text-purple-400 font-bold">5x</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">RTP:</span>
                <span className="text-white font-bold">96%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
