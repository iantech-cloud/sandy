'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Gamepad2, Wallet, Plus, Plane, Zap, Award, Lock, Play, ArrowRight, TrendingUp, Target, Layers, Dice5, TrendingDown } from 'lucide-react';
import Link from 'next/link';
import GamingWallet from './components/GamingWallet';

const GAMES = [
  {
    id: 'crash',
    name: 'Crash',
    description: 'Watch the multiplier climb. Cash out before it crashes!',
    icon: TrendingUp,
    minBet: 30,
    maxBet: 500000,
    color: 'from-blue-600 to-cyan-500',
    isActive: true,
    route: '/dashboard/gaming/crash',
  },
  {
    id: 'mines',
    name: 'Mines',
    description: 'Find the safe tiles and win big. Avoid the mines!',
    icon: Target,
    minBet: 30,
    maxBet: 500000,
    color: 'from-purple-600 to-pink-500',
    isActive: true,
    route: '/dashboard/gaming/mines',
  },
  {
    id: 'plinko',
    name: 'Plinko',
    description: 'Drop the ball and watch it bounce to multipliers.',
    icon: Layers,
    minBet: 30,
    maxBet: 500000,
    color: 'from-orange-600 to-red-500',
    isActive: true,
    route: '/dashboard/gaming/plinko',
  },
  {
    id: 'hi-lo',
    name: 'Hi-Lo',
    description: 'Predict higher or lower and multiply your winnings.',
    icon: TrendingDown,
    minBet: 30,
    maxBet: 500000,
    color: 'from-pink-600 to-rose-500',
    isActive: true,
    route: '/dashboard/gaming/hi-lo',
  },
  {
    id: 'dice',
    name: 'Dice',
    description: 'Predict the dice outcome and double your bet.',
    icon: Dice5,
    minBet: 30,
    maxBet: 500000,
    color: 'from-green-600 to-emerald-500',
    isActive: true,
    route: '/dashboard/gaming/dice',
  },
];

export default function GamingPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [gamingWalletOpen, setGamingWalletOpen] = useState(false);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4" />
          <p>Loading Gaming Dashboard...</p>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    router.push('/auth/login');
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4 md:p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white flex items-center gap-3 mb-2">
              <Gamepad2 size={40} className="text-purple-400" />
              Gaming Hub
            </h1>
            <p className="text-gray-400">Play games and multiply your earnings</p>
          </div>
          <button
            onClick={() => setGamingWalletOpen(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-6 py-3 rounded-lg font-semibold transition-all duration-300 shadow-lg hover:shadow-purple-500/50"
          >
            <Wallet size={20} />
            Gaming Wallet
          </button>
        </div>

        {/* Gaming Wallet Modal */}
        {gamingWalletOpen && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-4">
            <div className="bg-slate-900 border border-purple-500/30 rounded-t-3xl md:rounded-3xl w-full md:max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">
              <div className="sticky top-0 flex items-center justify-between p-6 border-b border-purple-500/20 bg-slate-900">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <Wallet size={28} className="text-purple-400" />
                  Gaming Wallet
                </h2>
                <button
                  onClick={() => setGamingWalletOpen(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>
              <GamingWallet onClose={() => setGamingWalletOpen(false)} />
            </div>
          </div>
        )}
      </div>

      {/* Games Grid */}
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          {GAMES.map((game) => {
            const GameIcon = game.icon;
            return (
              <div
                key={game.id}
                className="group relative overflow-hidden rounded-2xl cursor-pointer transition-all duration-300 hover:scale-105"
              >
                {/* Background Gradient */}
                <div className={`absolute inset-0 bg-gradient-to-br ${game.color} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />

                {/* Card Content */}
                <div className="relative bg-slate-800/80 backdrop-blur border border-purple-500/30 rounded-2xl p-6 h-full flex flex-col justify-between hover:border-purple-500/60 transition-colors duration-300">

                  {/* Game Icon */}
                  <div className="mb-4">
                    <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${game.color} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}>
                      <GameIcon size={32} className="text-white" />
                    </div>
                  </div>

                  {/* Game Name and Description */}
                  <div className="flex-1 mb-4">
                    <h3 className="text-xl font-bold text-white mb-2">{game.name}</h3>
                    <p className="text-sm text-gray-400 group-hover:text-gray-300 transition-colors">
                      {game.description}
                    </p>
                  </div>

                  {/* Game Stats */}
                  <div className="mb-4 space-y-2 text-xs text-gray-400">
                    <div className="flex justify-between">
                      <span>Min Bet:</span>
                      <span className="text-purple-400 font-semibold">KES {game.minBet.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Max Bet:</span>
                      <span className="text-purple-400 font-semibold">KES {game.maxBet.toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Play Button */}
                  <Link
                    href={game.route}
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-all duration-300 shadow-lg hover:shadow-purple-500/50"
                  >
                    <Play size={16} />
                    Play Now
                  </Link>
                </div>
              </div>
            );
          })}
        </div>


      </div>
    </div>
  );
}
