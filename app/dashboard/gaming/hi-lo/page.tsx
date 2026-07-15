'use client';

import { useState } from 'react';
import { ArrowLeft, Wallet, RotateCcw, TrendingUp, TrendingDown } from 'lucide-react';
import Link from 'next/link';

const CARDS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export default function HiLoGame() {
  const [bet, setBet] = useState(100);
  const [balance, setBalance] = useState(10000);
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'won' | 'lost'>('idle');
  const [currentCard, setCurrentCard] = useState<string | null>(null);
  const [nextCard, setNextCard] = useState<string | null>(null);
  const [multiplier, setMultiplier] = useState(1);
  const [streak, setStreak] = useState(0);

  const getRandomCard = () => CARDS[Math.floor(Math.random() * CARDS.length)];

  const startGame = () => {
    if (bet > balance || bet < 30) return;
    setCurrentCard(getRandomCard());
    setGameState('playing');
    setMultiplier(1);
    setStreak(0);
  };

  const predictCard = (prediction: 'higher' | 'lower') => {
    if (gameState !== 'playing' || !currentCard) return;

    const next = getRandomCard();
    setNextCard(next);

    const currentValue = CARDS.indexOf(currentCard);
    const nextValue = CARDS.indexOf(next);

    const isCorrect =
      (prediction === 'higher' && nextValue > currentValue) ||
      (prediction === 'lower' && nextValue < currentValue);

    if (isCorrect) {
      const newStreak = streak + 1;
      const newMultiplier = 1 + newStreak * 0.5;
      setStreak(newStreak);
      setMultiplier(newMultiplier);
      setCurrentCard(next);
      setNextCard(null);
    } else {
      setGameState('lost');
      setBalance((prev) => prev - bet);
    }
  };

  const cashOut = () => {
    if (gameState !== 'playing') return;
    const winnings = Math.floor(bet * multiplier);
    setGameState('won');
    setBalance((prev) => prev + winnings);
  };

  const resetGame = () => {
    setGameState('idle');
    setCurrentCard(null);
    setNextCard(null);
    setStreak(0);
    setMultiplier(1);
  };

  const getCardColor = (card: string) => {
    const value = CARDS.indexOf(card);
    if (value < 5) return 'bg-red-600';
    if (value < 9) return 'bg-yellow-600';
    return 'bg-green-600';
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
            <h1 className="text-4xl font-bold text-white mb-2">Hi-Lo</h1>
            <p className="text-gray-400">Predict if the next card is higher or lower</p>
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
            {/* Cards Display */}
            <div className="mb-8">
              <div className="grid grid-cols-3 gap-4 mb-8">
                {/* Current Card */}
                <div className="flex flex-col items-center">
                  <p className="text-sm text-gray-400 mb-4">Current Card</p>
                  {currentCard ? (
                    <div className={`${getCardColor(currentCard)} text-white rounded-lg p-8 text-4xl font-bold w-24 h-32 flex items-center justify-center`}>
                      {currentCard}
                    </div>
                  ) : (
                    <div className="bg-slate-700 text-gray-400 rounded-lg p-8 text-4xl font-bold w-24 h-32 flex items-center justify-center">
                      ?
                    </div>
                  )}
                </div>

                {/* Arrow */}
                <div className="flex items-center justify-center">
                  <div className="text-4xl text-purple-400">?</div>
                </div>

                {/* Next Card */}
                <div className="flex flex-col items-center">
                  <p className="text-sm text-gray-400 mb-4">Next Card</p>
                  {nextCard ? (
                    <div className={`${getCardColor(nextCard)} text-white rounded-lg p-8 text-4xl font-bold w-24 h-32 flex items-center justify-center`}>
                      {nextCard}
                    </div>
                  ) : (
                    <div className="bg-slate-700 text-gray-400 rounded-lg p-8 text-4xl font-bold w-24 h-32 flex items-center justify-center">
                      ?
                    </div>
                  )}
                </div>
              </div>

              {/* Game Controls */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Bet Amount (KES)</label>
                  <input
                    type="number"
                    value={bet}
                    onChange={(e) => setBet(Math.max(30, Number(e.target.value)))}
                    disabled={gameState === 'playing'}
                    className="w-full bg-slate-700 border border-purple-500/30 rounded-lg px-4 py-2 text-white disabled:opacity-50"
                    min="30"
                  />
                </div>

                {gameState === 'idle' && (
                  <button
                    onClick={startGame}
                    disabled={bet > balance || bet < 30}
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:bg-gray-600 text-white font-bold py-3 rounded-lg"
                  >
                    Start Game
                  </button>
                )}

                {gameState === 'playing' && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => predictCard('higher')}
                      className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2"
                    >
                      <TrendingUp size={20} />
                      Higher
                    </button>
                    <button
                      onClick={() => predictCard('lower')}
                      className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2"
                    >
                      <TrendingDown size={20} />
                      Lower
                    </button>
                  </div>
                )}

                {gameState === 'playing' && (
                  <button
                    onClick={cashOut}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 rounded-lg"
                  >
                    Cash Out at {multiplier.toFixed(2)}x
                  </button>
                )}

                {(gameState === 'won' || gameState === 'lost') && (
                  <button
                    onClick={resetGame}
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2"
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
            <h3 className="text-lg font-bold text-white mb-4">Stats</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Status:</span>
                <span className={`font-bold ${gameState === 'playing' ? 'text-yellow-400' : gameState === 'won' ? 'text-green-400' : gameState === 'lost' ? 'text-red-400' : 'text-gray-400'}`}>
                  {gameState.toUpperCase()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Streak:</span>
                <span className="text-white font-bold">{streak}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Multiplier:</span>
                <span className="text-purple-400 font-bold">{multiplier.toFixed(2)}x</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Min Bet:</span>
                <span className="text-white font-bold">KES 30</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
