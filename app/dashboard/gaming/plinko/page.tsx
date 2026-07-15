'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { ArrowLeft, Wallet, RotateCcw, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { playPlinko, getGamingWallet } from '@/app/actions/gaming-games';

const RISK_LEVELS = {
  low: { multipliers: [0.5, 0.8, 1.2, 1.5, 2.0, 1.5, 1.2, 0.8, 0.5], color: '#10b981' },
  medium: { multipliers: [0.2, 0.5, 1.5, 3.0, 10.0, 3.0, 1.5, 0.5, 0.2], color: '#f59e0b' },
  high: { multipliers: [0.1, 0.3, 0.5, 2.0, 100.0, 2.0, 0.5, 0.3, 0.1], color: '#ef4444' },
};

export default function PlinkoGame() {
  const { data: session } = useSession();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [bet, setBet] = useState(50000);
  const [riskLevel, setRiskLevel] = useState<'low' | 'medium' | 'high'>('medium');
  const [gameState, setGameState] = useState<'setup' | 'dropping' | 'done'>('setup');
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ amount: number; multiplier: number; slot: number } | null>(null);
  const [history, setHistory] = useState<{ risk: string; multiplier: number; amount: number }[]>([]);

  const MIN_BET = 3000;
  const MAX_BET = 7000000; // 70,000 KES
  const ROWS = 12;
  const SLOTS = 9;

  // Animation refs
  const ballRef = useRef({ x: 0, y: 0, vx: 0, vy: 0 });
  const pegsRef = useRef<Array<{ x: number; y: number }>>([]);

  useEffect(() => {
    if (session?.user?.id) {
      fetchBalance();
      initializePegs();
    }
  }, [session]);

  const fetchBalance = async () => {
    try {
      const response = await fetch('/api/gaming/wallet');
      const data = await response.json();
      setBalance(data.balance_cents || 0);
    } catch (err) {
      console.error('Failed to fetch balance:', err);
    }
  };

  const initializePegs = () => {
    const pegs: Array<{ x: number; y: number }> = [];
    const canvas = canvasRef.current;
    if (!canvas) return;

    const width = 500;
    const height = 600;
    const spacingX = width / (SLOTS + 1);
    const spacingY = height / (ROWS + 1);

    for (let row = 0; row < ROWS; row++) {
      const offset = row % 2 === 0 ? 0 : spacingX / 2;
      for (let col = 0; col < SLOTS; col++) {
        pegs.push({
          x: offset + spacingX * (col + 1),
          y: spacingY * (row + 1),
        });
      }
    }

    pegsRef.current = pegs;
  };

  // Draw plinko board
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw pegs
      ctx.fillStyle = '#a78bfa';
      pegsRef.current.forEach(peg => {
        ctx.beginPath();
        ctx.arc(peg.x, peg.y, 5, 0, Math.PI * 2);
        ctx.fill();
      });

      // Draw slots at bottom
      const slotWidth = canvas.width / SLOTS;
      const slotY = canvas.height - 40;
      const multipliers = RISK_LEVELS[riskLevel].multipliers;

      multipliers.forEach((mult, i) => {
        const x = i * slotWidth + slotWidth / 2;
        const color = mult >= 3 ? '#10b981' : mult >= 1.5 ? '#f59e0b' : '#ef4444';
        
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.2;
        ctx.fillRect(i * slotWidth + 2, slotY, slotWidth - 4, 40);
        ctx.globalAlpha = 1.0;

        ctx.fillStyle = color;
        ctx.font = 'bold 14px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(mult.toFixed(2) + 'x', x, slotY + 25);
      });

      // Draw ball if dropping
      if (gameState === 'dropping' && result) {
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(ballRef.current.x, ballRef.current.y, 8, 0, Math.PI * 2);
        ctx.fill();

        // Glow
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.arc(ballRef.current.x, ballRef.current.y, 12, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1.0;
      }

      requestAnimationFrame(draw);
    };

    const animationId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animationId);
  }, [gameState, riskLevel, result]);

  // Animate ball
  useEffect(() => {
    if (gameState !== 'dropping') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const gravity = 0.3;
    const damping = 0.99;
    const bounce = 0.8;
    const friction = 0.98;

    ballRef.current = {
      x: canvas.width / 2,
      y: 30,
      vx: 0,
      vy: 0,
    };

    const animate = () => {
      const ball = ballRef.current;

      // Apply gravity
      ball.vy += gravity;
      ball.x += ball.vx;
      ball.y += ball.vy;

      // Friction
      ball.vx *= friction;

      // Collision with pegs
      pegsRef.current.forEach(peg => {
        const dx = ball.x - peg.x;
        const dy = ball.y - peg.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const minDist = 8 + 5; // Ball radius + peg radius

        if (dist < minDist) {
          const angle = Math.atan2(dy, dx);
          ball.x = peg.x + Math.cos(angle) * minDist;
          ball.y = peg.y + Math.sin(angle) * minDist;

          const speed = Math.sqrt(ball.vx ** 2 + ball.vy ** 2);
          ball.vx = Math.cos(angle) * speed * bounce + (Math.random() - 0.5) * 2;
          ball.vy = Math.sin(angle) * speed * bounce;
        }
      });

      // Boundaries
      if (ball.x - 8 < 0) {
        ball.x = 8;
        ball.vx = Math.abs(ball.vx) * bounce;
      }
      if (ball.x + 8 > canvas.width) {
        ball.x = canvas.width - 8;
        ball.vx = -Math.abs(ball.vx) * bounce;
      }

      // Check if ball reached bottom
      if (ball.y > canvas.height - 40) {
        const slotWidth = canvas.width / SLOTS;
        const slot = Math.floor(ball.x / slotWidth);
        const finalSlot = Math.max(0, Math.min(SLOTS - 1, slot));

        setGameState('done');
        const multiplier = RISK_LEVELS[riskLevel].multipliers[finalSlot];
        const winAmount = Math.floor(bet * multiplier);

        setResult({
          amount: winAmount,
          multiplier,
          slot: finalSlot,
        });

        setBalance(prev => prev + winAmount);
        setHistory(prev => [
          { risk: riskLevel, multiplier, amount: winAmount },
          ...prev.slice(0, 19),
        ]);

        return;
      }

      requestAnimationFrame(animate);
    };

    animate();
  }, [gameState, riskLevel, bet]);

  const startGame = () => {
    setError(null);

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
    setGameState('dropping');
    setResult(null);
    setLoading(false);
  };

  const playAgain = () => {
    setGameState('setup');
    setResult(null);
    fetchBalance();
  };

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
              <h1 className="text-2xl font-bold text-white">Plinko</h1>
              <p className="text-sm text-gray-400">Drop the ball and win big</p>
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

            {/* Game Canvas */}
            <div className="bg-slate-800/50 border border-purple-500/30 rounded-xl p-6 mb-6">
              <canvas
                ref={canvasRef}
                width={500}
                height={650}
                className="w-full bg-slate-900 rounded-lg"
              />
            </div>

            {/* Result */}
            {result && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-6 mb-6">
                <p className="text-green-400 font-semibold text-sm mb-2">YOU WON!</p>
                <p className="text-3xl font-bold text-green-400">+KES {(result.amount / 100).toLocaleString()}</p>
                <p className="text-green-400 text-sm mt-2">Multiplier: {result.multiplier.toFixed(2)}x</p>
              </div>
            )}
          </div>

          {/* Sidebar - Controls */}
          <div className="space-y-6">
            {/* Controls */}
            <div className="bg-slate-800/50 border border-purple-500/30 rounded-xl p-6">
              <h2 className="text-lg font-bold text-white mb-4">Game Settings</h2>

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

                {/* Risk Level */}
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">Risk Level</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['low', 'medium', 'high'] as const).map(level => (
                      <button
                        key={level}
                        onClick={() => setRiskLevel(level)}
                        disabled={gameState !== 'setup'}
                        className={`py-2 px-3 rounded-lg font-semibold text-sm transition-all ${
                          riskLevel === level
                            ? 'bg-purple-600 text-white border border-purple-400'
                            : 'bg-slate-700 text-gray-300 border border-slate-600 hover:border-purple-500'
                        } disabled:opacity-50`}
                      >
                        {level.charAt(0).toUpperCase() + level.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Multipliers Preview */}
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">Prize Multipliers</label>
                  <div className="grid grid-cols-3 gap-1">
                    {RISK_LEVELS[riskLevel].multipliers.map((mult, i) => (
                      <div key={i} className={`p-2 rounded text-center text-xs font-semibold ${
                        mult >= 3 ? 'bg-green-500/30 text-green-400' : mult >= 1.5 ? 'bg-yellow-500/30 text-yellow-400' : 'bg-red-500/30 text-red-400'
                      }`}>
                        {mult.toFixed(2)}x
                      </div>
                    ))}
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
                      onClick={startGame}
                      disabled={loading || balance < MIN_BET}
                      title={balance < MIN_BET ? `Minimum KES ${MIN_BET / 100} required to play` : ''}
                      className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-3 rounded-lg disabled:opacity-50 transition-all"
                    >
                      Drop Ball
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
              <h3 className="text-sm font-bold text-white mb-3">Recent Drops</h3>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {history.length === 0 ? (
                  <p className="text-gray-400 text-sm">No games yet</p>
                ) : (
                  history.map((game, i) => (
                    <div key={i} className="p-3 rounded-lg bg-slate-700/50 border border-slate-600/50">
                      <div className="flex items-center justify-between">
                        <div className="text-xs">
                          <p className="font-semibold text-white capitalize">{game.risk}</p>
                          <p className="text-gray-400">{game.multiplier.toFixed(2)}x</p>
                        </div>
                        <p className="text-green-400 font-semibold text-sm">+KES {(game.amount / 100).toLocaleString('en', { maximumFractionDigits: 0 })}</p>
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
