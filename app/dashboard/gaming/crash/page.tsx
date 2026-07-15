'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Wallet, RotateCcw, AlertCircle, TrendingUp, Zap } from 'lucide-react';
import Link from 'next/link';
import { playCrash, getGamingWallet } from '@/app/actions/gaming-games';

export default function CrashGame() {
  const { data: session } = useSession();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Game state
  const [bet, setBet] = useState(50000); // 500 KES
  const [balance, setBalance] = useState(0);
  const [autoCashout, setAutoCashout] = useState(2.0);
  const [gameState, setGameState] = useState<'waiting' | 'playing' | 'crashed'>('waiting');
  const [currentMultiplier, setCurrentMultiplier] = useState(1.0);
  const [crashPoint, setCrashPoint] = useState<number | null>(null);
  const [playerCashedOut, setPlayerCashedOut] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ won: boolean; amount: number; multiplier: number } | null>(null);
  const [history, setHistory] = useState<number[]>([]);
  const [gameStartCountdown, setGameStartCountdown] = useState(5);

  const MIN_BET = 3000;
  const MAX_BET = 7000000; // 70,000 KES
  const gameLoopRef = useRef<any>(null);
  const multiplierRef = useRef(1.0);
  const targetCrashRef = useRef<number>(0);

  // Fetch balance on mount
  useEffect(() => {
    if (session?.user?.id) {
      fetchBalance();
    }
  }, [session]);

  const fetchBalance = async () => {
    try {
      const response = await fetch('/api/gaming/wallet', {
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      setBalance(data.balance_cents || 0);
    } catch (err) {
      console.error('Failed to fetch balance:', err);
    }
  };

  // Countdown before game start
  useEffect(() => {
    if (gameState !== 'waiting') return;
    if (gameStartCountdown > 0) {
      const timer = setTimeout(() => setGameStartCountdown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [gameStartCountdown, gameState]);

  // Draw crash graph
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      const width = canvas.width;
      const height = canvas.height;
      const padding = 40;

      // Clear canvas
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, width, height);

      // Draw grid
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 0.5;
      for (let i = 0; i <= 10; i++) {
        const x = padding + ((width - padding * 2) / 10) * i;
        const y = padding + ((height - padding * 2) / 10) * i;
        ctx.beginPath();
        ctx.moveTo(x, padding);
        ctx.lineTo(x, height - padding);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(width - padding, y);
        ctx.stroke();
      }

      // Draw multiplier curve
      ctx.strokeStyle = gameState === 'crashed' && crashPoint ? '#ef4444' : '#a78bfa';
      ctx.lineWidth = 3;
      ctx.beginPath();

      let started = false;
      for (let x = padding; x < width - padding; x += 2) {
        const progress = (x - padding) / (width - padding * 2);
        let multiplier: number;

        if (crashPoint !== null && gameState === 'crashed') {
          const displayMultiplier = Math.min(progress * 3, crashPoint / 20);
          multiplier = Math.exp(displayMultiplier * 1.5);
        } else {
          const displayMultiplier = Math.min(progress * 3, currentMultiplier / 20);
          multiplier = Math.exp(displayMultiplier * 1.5);
        }

        const y = height - padding - (Math.log(multiplier + 1) / Math.log(20)) * (height - padding * 2);

        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      // Draw auto cashout line if enabled
      if (autoCashout > 0 && autoCashout < 50) {
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        const cashoutY = height - padding - (Math.log(autoCashout + 1) / Math.log(20)) * (height - padding * 2);
        ctx.beginPath();
        ctx.moveTo(padding, cashoutY);
        ctx.lineTo(width - padding, cashoutY);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Draw plane/rocket position
      if (gameState === 'playing' || (gameState === 'crashed' && crashPoint)) {
        const displayMultiplier = gameState === 'crashed' && crashPoint ? crashPoint : currentMultiplier;
        const progress = Math.min((displayMultiplier / 20) * (width - padding * 2), width - padding * 2 - 20);
        const planeX = padding + progress;
        const planeY = height - padding - (Math.log(displayMultiplier + 1) / Math.log(20)) * (height - padding * 2);

        // Draw plane
        ctx.fillStyle = gameState === 'crashed' ? '#ef4444' : '#10b981';
        ctx.beginPath();
        ctx.arc(planeX, planeY, 10, 0, Math.PI * 2);
        ctx.fill();

        // Draw glow
        ctx.strokeStyle = gameState === 'crashed' ? '#fca5a5' : '#86efac';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(planeX, planeY, 15, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Draw multiplier text
      ctx.fillStyle = gameState === 'crashed' && crashPoint ? '#ef4444' : '#a78bfa';
      ctx.font = 'bold 48px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      const displayText = (gameState === 'crashed' && crashPoint ? crashPoint : currentMultiplier).toFixed(2) + 'x';
      ctx.shadowColor = gameState === 'crashed' ? 'rgba(239, 68, 68, 0.5)' : 'rgba(167, 139, 250, 0.5)';
      ctx.shadowBlur = 10;
      ctx.fillText(displayText, width / 2, 60);

      requestAnimationFrame(draw);
    };

    const animationId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animationId);
  }, [gameState, currentMultiplier, crashPoint, autoCashout]);

  // Game loop
  useEffect(() => {
    if (gameState !== 'playing') return;

    const startTime = Date.now();
    const targetCrashTime = Math.random() * 45000 + 2000; // 2-47 seconds
    targetCrashRef.current = targetCrashTime;

    gameLoopRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / targetCrashTime, 1);

      if (progress >= 1) {
        // Game crashed
        const finalMultiplier = Math.exp(Math.random() * 3);
        setCrashPoint(finalMultiplier);
        setGameState('crashed');
        setHistory(prev => [finalMultiplier, ...prev.slice(0, 19)]);
        clearInterval(gameLoopRef.current);
        return;
      }

      const multiplier = Math.exp(progress * (Math.random() * 2 + 1.5));
      setCurrentMultiplier(multiplier);
      multiplierRef.current = multiplier;

      // Auto cashout
      if (autoCashout > 0 && multiplier >= autoCashout && !playerCashedOut && gameState === 'playing') {
        handleCashout(multiplier);
      }
    }, 50);

    return () => clearInterval(gameLoopRef.current);
  }, [gameState, autoCashout, playerCashedOut]);

  const handleBet = async () => {
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
    setGameState('waiting');
    setGameStartCountdown(5);
    setCurrentMultiplier(1.0);
    setCrashPoint(null);
    setPlayerCashedOut(false);
    setResult(null);

    // Wait for countdown
    setTimeout(() => {
      setGameState('playing');
      setLoading(false);
    }, 5000);
  };

  const handleCashout = async (multiplier: number = currentMultiplier) => {
    if (gameState !== 'playing') return;

    setPlayerCashedOut(true);
    setGameState('crashed');

    const winAmount = Math.floor(bet * multiplier);
    setResult({
      won: true,
      amount: winAmount,
      multiplier,
    });

    setBalance(prev => prev + winAmount);

    // Record result
    try {
      await playCrash(bet, multiplier);
    } catch (err) {
      console.error('Failed to record game result:', err);
    }

    fetchBalance();
  };

  const handlePlayAgain = () => {
    setGameState('waiting');
    setResult(null);
    setGameStartCountdown(5);
    setCurrentMultiplier(1.0);
  };

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-800/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/gaming"
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <ArrowLeft size={20} className="text-gray-400" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-white">Crash</h1>
              <p className="text-sm text-gray-400">Cash out before it crashes!</p>
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
                width={700}
                height={500}
                className="w-full bg-slate-900 rounded-lg"
              />
            </div>

            {/* Game Status */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                <p className="text-gray-400 text-xs mb-1">Your Bet</p>
                <p className="text-white font-bold text-lg">KES {(bet / 100).toLocaleString()}</p>
              </div>
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                <p className="text-gray-400 text-xs mb-1">Status</p>
                <p className={`font-bold text-lg ${
                  gameState === 'playing' ? 'text-green-400' : gameState === 'crashed' ? 'text-red-400' : 'text-gray-300'
                }`}>
                  {gameState === 'waiting' ? 'Ready' : gameState === 'playing' ? 'Playing' : 'Crashed'}
                </p>
              </div>
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                <p className="text-gray-400 text-xs mb-1">Potential Win</p>
                <p className="text-green-400 font-bold text-lg">
                  KES {((bet * currentMultiplier) / 100).toLocaleString('en', { maximumFractionDigits: 0 })}
                </p>
              </div>
            </div>

            {/* Result Panel */}
            {result && (
              <div className={`p-6 rounded-lg border mb-6 ${result.won ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                <p className={`text-sm font-semibold mb-2 ${result.won ? 'text-green-400' : 'text-red-400'}`}>
                  {result.won ? 'CASHED OUT SUCCESSFULLY!' : 'GAME CRASHED!'}
                </p>
                <p className={`text-3xl font-bold ${result.won ? 'text-green-400' : 'text-red-400'}`}>
                  {result.won ? '+' : ''}KES {(result.amount / 100).toLocaleString()}
                </p>
              </div>
            )}
          </div>

          {/* Sidebar - Controls & History */}
          <div className="space-y-6">
            {/* Bet Controls */}
            <div className="bg-slate-800/50 border border-purple-500/30 rounded-xl p-6">
              <h2 className="text-lg font-bold text-white mb-4">Place Bet</h2>

              <div className="space-y-4">
                {/* Bet Amount */}
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">Bet Amount (KES)</label>
                  <input
                    type="number"
                    value={bet / 100}
                    onChange={(e) => setBet(parseInt(e.target.value) * 100)}
                    disabled={gameState !== 'waiting' || loading}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:border-purple-500 focus:outline-none disabled:opacity-50"
                  />
                </div>

                {/* Quick Bets */}
                <div className="flex gap-2 flex-wrap">
                  {[100, 500, 1000, 5000].map(amount => (
                    <button
                      key={amount}
                      onClick={() => setBet(amount * 100)}
                      disabled={gameState !== 'waiting' || amount * 100 > balance}
                      className="px-3 py-1 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-lg text-white text-xs disabled:opacity-50 transition-colors"
                    >
                      KES {amount}
                    </button>
                  ))}
                </div>

                {/* Auto Cashout */}
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">Auto Cashout (Multiplier)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={autoCashout}
                    onChange={(e) => setAutoCashout(parseFloat(e.target.value))}
                    disabled={gameState !== 'waiting'}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:border-purple-500 focus:outline-none disabled:opacity-50"
                  />
                  <p className="text-xs text-gray-400 mt-1">0 = Disabled</p>
                </div>

                {/* Buttons */}
                {gameState === 'waiting' && (
                  <button
                    onClick={handleBet}
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-3 rounded-lg disabled:opacity-50 transition-all"
                  >
                    {loading ? 'Starting...' : 'Place Bet'}
                  </button>
                )}

                {gameStartCountdown > 0 && gameState === 'waiting' && (
                  <div className="text-center py-3 bg-purple-500/20 rounded-lg">
                    <p className="text-purple-300 font-semibold">Game starts in {gameStartCountdown}s</p>
                  </div>
                )}

                {gameState === 'playing' && (
                  <button
                    onClick={() => handleCashout()}
                    className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold py-3 rounded-lg transition-all animate-pulse flex items-center justify-center gap-2"
                  >
                    <Zap size={20} />
                    Cash Out - {currentMultiplier.toFixed(2)}x
                  </button>
                )}

                {gameState === 'crashed' && (
                  <button
                    onClick={handlePlayAgain}
                    className="w-full bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-500 hover:to-slate-600 text-white font-bold py-3 rounded-lg transition-all flex items-center justify-center gap-2"
                  >
                    <RotateCcw size={20} />
                    Play Again
                  </button>
                )}
              </div>
            </div>

            {/* Recent History */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
              <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                <TrendingUp size={16} />
                Recent Multipliers
              </h3>
              <div className="grid grid-cols-4 gap-2">
                {history.slice(0, 12).map((multiplier, i) => (
                  <div
                    key={i}
                    className={`p-2 rounded-lg text-center text-xs font-semibold ${
                      multiplier > 2 ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-gray-300'
                    }`}
                  >
                    {multiplier.toFixed(2)}x
                  </div>
                ))}
              </div>
            </div>

            {/* Live Players */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
              <h3 className="text-sm font-bold text-white mb-3">Live Players</h3>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between text-gray-300">
                  <span>Players in game: 5</span>
                  <span className="text-green-400 font-semibold">Active</span>
                </div>
                <div className="flex items-center justify-between text-gray-300">
                  <span>Total wagered: KES 50,000</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const playSound = (type: string) => {
    if (!soundEnabled) return;
    // Sound would play here
  };

  const startGame = async () => {
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
        setError(result.error || 'Game failed');
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
            {/* Error Alert */}
            {error && (
              <div className="mb-6 bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="text-red-400 flex-shrink-0 mt-0.5" size={20} />
                <div>
                  <p className="text-red-400 font-semibold text-sm">{error}</p>
                </div>
              </div>
            )}

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
