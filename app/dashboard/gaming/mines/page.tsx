'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Wallet, RotateCcw, Bomb, Star } from 'lucide-react';
import Link from 'next/link';

interface GameState {
  status: 'idle' | 'playing' | 'won' | 'lost';
  revealed: boolean[];
  mines: boolean[];
  safeClicks: number;
  multiplier: number;
}

export default function MinesGame() {
  const router = useRouter();
  const [bet, setBet] = useState(100);
  const [mineCount, setMineCount] = useState(3);
  const [balance, setBalance] = useState(10000);
  const [gameState, setGameState] = useState<GameState>({
    status: 'idle',
    revealed: Array(25).fill(false),
    mines: Array(25).fill(false),
    safeClicks: 0,
    multiplier: 1.0,
  });

  const startGame = () => {
    if (bet > balance || bet < 30) return;

    const mines = Array(25).fill(false);
    for (let i = 0; i < mineCount; i++) {
      let idx;
      do {
        idx = Math.floor(Math.random() * 25);
      } while (mines[idx]);
      mines[idx] = true;
    }

    setGameState({
      status: 'playing',
      revealed: Array(25).fill(false),
      mines,
      safeClicks: 0,
      multiplier: 1.0,
    });
  };

  const clickTile = (idx: number) => {
    if (gameState.status !== 'playing' || gameState.revealed[idx]) return;

    const newRevealed = [...gameState.revealed];
    newRevealed[idx] = true;

    if (gameState.mines[idx]) {
      // Hit a mine - lose
      setGameState((prev) => ({
        ...prev,
        status: 'lost',
        revealed: newRevealed,
      }));
      setBalance((prev) => prev - bet);
    } else {
      // Safe tile
      const safeClicks = gameState.safeClicks + 1;
      const maxSafeTiles = 25 - mineCount;
      const multiplier = 1 + (safeClicks / maxSafeTiles) * 5;

      if (safeClicks === maxSafeTiles) {
        // Won - all safe tiles revealed
        const winnings = Math.floor(bet * multiplier);
        setGameState((prev) => ({
          ...prev,
          status: 'won',
          revealed: newRevealed,
          safeClicks,
          multiplier,
        }));
        setBalance((prev) => prev + winnings);
      } else {
        setGameState((prev) => ({
          ...prev,
          revealed: newRevealed,
          safeClicks,
          multiplier,
        }));
      }
    }
  };

  const cashOut = () => {
    if (gameState.status !== 'playing') return;
    const winnings = Math.floor(bet * gameState.multiplier);
    setGameState((prev) => ({ ...prev, status: 'won' }));
    setBalance((prev) => prev + winnings);
  };

  const resetGame = () => {
    setGameState({
      status: 'idle',
      revealed: Array(25).fill(false),
      mines: Array(25).fill(false),
      safeClicks: 0,
      multiplier: 1.0,
    });
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
            <h1 className="text-4xl font-bold text-white mb-2">Mines</h1>
            <p className="text-gray-400">Find the safe tiles and avoid the mines!</p>
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
            {/* Game Grid */}
            <div className="mb-6">
              <div className="grid grid-cols-5 gap-3 mb-6">
                {gameState.revealed.map((revealed, idx) => (
                  <button
                    key={idx}
                    onClick={() => clickTile(idx)}
                    disabled={gameState.status !== 'playing' || revealed}
                    className={`aspect-square rounded-lg font-bold text-white transition-all disabled:cursor-not-allowed flex items-center justify-center ${
                      revealed
                        ? gameState.mines[idx]
                          ? 'bg-red-600'
                          : 'bg-green-600'
                        : 'bg-slate-700 hover:bg-slate-600'
                    }`}
                  >
                    {revealed && (gameState.mines[idx] ? <Bomb size={24} /> : <Star size={24} />)}
                  </button>
                ))}
              </div>

              {/* Controls */}
              <div className="space-y-4">
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

                <div>
                  <label className="block text-sm text-gray-400 mb-2">Number of Mines ({mineCount})</label>
                  <input
                    type="range"
                    min="1"
                    max="24"
                    value={mineCount}
                    onChange={(e) => setMineCount(Number(e.target.value))}
                    disabled={gameState.status === 'playing'}
                    className="w-full disabled:opacity-50"
                  />
                </div>

                {gameState.status === 'idle' && (
                  <button
                    onClick={startGame}
                    disabled={bet > balance || bet < 30}
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:bg-gray-600 text-white font-bold py-3 rounded-lg transition-all"
                  >
                    Start Game
                  </button>
                )}

                {gameState.status === 'playing' && (
                  <button
                    onClick={cashOut}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg transition-all"
                  >
                    Cash Out at {gameState.multiplier.toFixed(2)}x
                  </button>
                )}

                {(gameState.status === 'won' || gameState.status === 'lost') && (
                  <button
                    onClick={resetGame}
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all"
                  >
                    <RotateCcw size={20} />
                    Try Again
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="bg-slate-800/80 border border-purple-500/30 rounded-2xl p-6">
            <h3 className="text-lg font-bold text-white mb-4">Game Stats</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Status:</span>
                <span className={`font-bold ${gameState.status === 'playing' ? 'text-yellow-400' : gameState.status === 'won' ? 'text-green-400' : gameState.status === 'lost' ? 'text-red-400' : 'text-gray-400'}`}>
                  {gameState.status.toUpperCase()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Safe Tiles:</span>
                <span className="text-white font-bold">{gameState.safeClicks}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Multiplier:</span>
                <span className="text-purple-400 font-bold">{gameState.multiplier.toFixed(2)}x</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Mines:</span>
                <span className="text-red-400 font-bold">{mineCount}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
