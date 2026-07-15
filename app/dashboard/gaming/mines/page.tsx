'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { ArrowLeft, Wallet, RotateCcw, Bomb, Star, AlertCircle, Zap, Loader } from 'lucide-react';
import Link from 'next/link';
import { playMines, getGamingWallet } from '@/app/actions/gaming-games';

export default function MinesGame() {
  const { data: session } = useSession();

  const [bet, setBet] = useState(50000);
  const [mineCount, setMineCount] = useState(5);
  const [gameState, setGameState] = useState<'setup' | 'playing' | 'won' | 'lost'>('setup');
  const [tiles, setTiles] = useState<{ isMine: boolean; revealed: boolean }[]>([]);
  const [minePositions, setMinePositions] = useState<number[]>([]);
  const [balance, setBalance] = useState(0);
  const [revealedCount, setRevealedCount] = useState(0);
  const [currentMultiplier, setCurrentMultiplier] = useState(1.0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ won: boolean; amount: number; revealedSafeTiles: number } | null>(null);
  const [history, setHistory] = useState<{ mines: number; revealed: number; multiplier: number; result: 'win' | 'lose' }[]>([]);

  const MIN_BET = 3000;
  const MAX_BET = 7000000; // 70,000 KES
  const GRID_SIZE = 25;
  const SAFE_TILES = GRID_SIZE - mineCount;

  useEffect(() => {
    if (session?.user?.id) {
      fetchBalance();
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

  const calculateMultiplier = (revealed: number) => {
    if (revealed === 0) return 1.0;
    return Math.pow(SAFE_TILES / (SAFE_TILES - revealed), revealed);
  };

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

    // Deduct bet from balance
    setBalance(prev => prev - bet);

    // Generate mine positions
    const mines: number[] = [];
    while (mines.length < mineCount) {
      const pos = Math.floor(Math.random() * GRID_SIZE);
      if (!mines.includes(pos)) mines.push(pos);
    }

    setMinePositions(mines);
    setTiles(Array(GRID_SIZE).fill(null).map(() => ({ isMine: false, revealed: false })));
    setRevealedCount(0);
    setCurrentMultiplier(1.0);
    setGameState('playing');
    setResult(null);
  };

  const revealTile = async (index: number) => {
    if (gameState !== 'playing' || tiles[index].revealed || loading) return;

    setLoading(true);

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 300));

    const isMine = minePositions.includes(index);
    const newTiles = [...tiles];
    newTiles[index].revealed = true;
    newTiles[index].isMine = isMine;
    setTiles(newTiles);

    if (isMine) {
      // Hit a mine - game over
      setGameState('lost');
      setResult({
        won: false,
        amount: 0,
        revealedSafeTiles: revealedCount,
      });

      try {
        await playMines(bet, mineCount, revealedCount);
      } catch (err) {
        console.error('Failed to record game:', err);
      }

      setHistory(prev => [
        { mines: mineCount, revealed: revealedCount, multiplier: currentMultiplier, result: 'lose' },
        ...prev.slice(0, 19),
      ]);
    } else {
      // Safe tile
      const newRevealed = revealedCount + 1;
      const newMultiplier = calculateMultiplier(newRevealed);
      setRevealedCount(newRevealed);
      setCurrentMultiplier(newMultiplier);

      if (newRevealed === SAFE_TILES) {
        // Won - all safe tiles revealed
        setGameState('won');
        const winAmount = Math.floor(bet * newMultiplier);
        setBalance(prev => prev + winAmount);
        setResult({
          won: true,
          amount: winAmount,
          revealedSafeTiles: newRevealed,
        });

        setHistory(prev => [
          { mines: mineCount, revealed: newRevealed, multiplier: newMultiplier, result: 'win' },
          ...prev.slice(0, 19),
        ]);
      }
    }

    setLoading(false);
  };

  const cashOut = async () => {
    if (gameState !== 'playing' || revealedCount === 0) return;

    setGameState('won');
    const winAmount = Math.floor(bet * currentMultiplier);
    setBalance(prev => prev + winAmount);
    setResult({
      won: true,
      amount: winAmount,
      revealedSafeTiles: revealedCount,
    });

    try {
      await playMines(bet, mineCount, revealedCount);
    } catch (err) {
      console.error('Failed to record game:', err);
    }

    setHistory(prev => [
      { mines: mineCount, revealed: revealedCount, multiplier: currentMultiplier, result: 'win' },
      ...prev.slice(0, 19),
    ]);
  };

  const resetGame = () => {
    setGameState('setup');
    setTiles([]);
    setMinePositions([]);
    setRevealedCount(0);
    setCurrentMultiplier(1.0);
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
              <h1 className="text-2xl font-bold text-white">Mines</h1>
              <p className="text-sm text-gray-400">Avoid the mines, cash out anytime</p>
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

            {/* Game Grid */}
            <div className="bg-slate-800/50 border border-purple-500/30 rounded-xl p-6 mb-6">
              <h2 className="text-lg font-bold text-white mb-4">Game Grid ({mineCount} mines hidden)</h2>

              <div className="bg-slate-900 p-6 rounded-lg mb-6">
                <div className="grid grid-cols-5 gap-3">
                  {tiles.length > 0 && tiles.map((tile, i) => (
                    <button
                      key={i}
                      onClick={() => revealTile(i)}
                      disabled={gameState !== 'playing' || tile.revealed || loading}
                      className={`aspect-square rounded-lg font-bold text-2xl transition-all flex items-center justify-center ${
                        tile.revealed
                          ? tile.isMine
                            ? 'bg-red-600 text-white border-2 border-red-400 cursor-not-allowed'
                            : 'bg-green-600 text-white border-2 border-green-400 cursor-not-allowed'
                          : 'bg-gradient-to-br from-slate-700 to-slate-800 hover:from-slate-600 hover:to-slate-700 border-2 border-purple-500/30 text-white cursor-pointer hover:border-purple-500'
                      }`}
                    >
                      {tile.revealed && tile.isMine && <Bomb size={24} />}
                      {tile.revealed && !tile.isMine && <Star size={24} />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-slate-700/50 rounded-lg p-4">
                  <p className="text-gray-400 text-xs mb-1">Safe Revealed</p>
                  <p className="text-white font-bold text-lg">{revealedCount}/{SAFE_TILES}</p>
                </div>
                <div className="bg-slate-700/50 rounded-lg p-4">
                  <p className="text-gray-400 text-xs mb-1">Current Multiplier</p>
                  <p className="text-purple-400 font-bold text-lg">{currentMultiplier.toFixed(2)}x</p>
                </div>
                <div className="bg-slate-700/50 rounded-lg p-4">
                  <p className="text-gray-400 text-xs mb-1">Potential Win</p>
                  <p className="text-green-400 font-bold text-lg">KES {((bet * currentMultiplier) / 100).toLocaleString('en', { maximumFractionDigits: 0 })}</p>
                </div>
              </div>

              {/* Result */}
              {result && (
                <div className={`p-6 rounded-lg border mb-6 ${result.won ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                  <p className={`text-sm font-semibold mb-2 ${result.won ? 'text-green-400' : 'text-red-400'}`}>
                    {result.won ? 'NICE! YOU CASHED OUT!' : 'HIT A MINE!'}
                  </p>
                  <p className={`text-3xl font-bold ${result.won ? 'text-green-400' : 'text-red-400'}`}>
                    {result.won ? '+' : ''}KES {(result.amount / 100).toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar - Controls */}
          <div className="space-y-6">
            {/* Controls */}
            <div className="bg-slate-800/50 border border-purple-500/30 rounded-xl p-6">
              <h2 className="text-lg font-bold text-white mb-4">Game Setup</h2>

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

                {/* Mine Count */}
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">Number of Mines (1-20)</label>
                  <select
                    value={mineCount}
                    onChange={(e) => setMineCount(parseInt(e.target.value))}
                    disabled={gameState !== 'setup'}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:border-purple-500 focus:outline-none disabled:opacity-50"
                  >
                    {Array(20).fill(0).map((_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {i + 1} Mine{i > 0 ? 's' : ''}
                      </option>
                    ))}
                  </select>
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
                <div className="space-y-2 pt-4">
                  {gameState === 'setup' && (
                    <button
                      onClick={startGame}
                      disabled={loading}
                      className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-3 rounded-lg disabled:opacity-50 transition-all"
                    >
                      Start Game
                    </button>
                  )}

                  {gameState === 'playing' && (
                    <button
                      onClick={cashOut}
                      disabled={revealedCount === 0 || loading}
                      className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold py-3 rounded-lg disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                    >
                      <Zap size={20} />
                      Cash Out - {currentMultiplier.toFixed(2)}x
                    </button>
                  )}

                  {(gameState === 'won' || gameState === 'lost') && (
                    <button
                      onClick={resetGame}
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
              <h3 className="text-sm font-bold text-white mb-3">Recent Games</h3>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {history.length === 0 ? (
                  <p className="text-gray-400 text-sm">No games yet</p>
                ) : (
                  history.map((game, i) => (
                    <div key={i} className={`p-3 rounded-lg border ${game.result === 'win' ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                      <div className="flex items-center justify-between">
                        <div className="text-xs">
                          <p className="font-semibold text-white">{game.mines} mines • {game.revealed} revealed</p>
                          <p className={game.result === 'win' ? 'text-green-400' : 'text-red-400'}>{game.multiplier.toFixed(2)}x</p>
                        </div>
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
