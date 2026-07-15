'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { ArrowLeft, Wallet, RotateCcw, AlertCircle, Zap } from 'lucide-react';
import Link from 'next/link';
import { playHiLo, getGamingWallet } from '@/app/actions/gaming-games';

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

const getCardValue = (rank: string): number => {
  const rankMap: { [key: string]: number } = {
    'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13,
  };
  return rankMap[rank] || 0;
};

interface Card {
  rank: string;
  suit: string;
}

const getRandomCard = (): Card => ({
  rank: RANKS[Math.floor(Math.random() * RANKS.length)],
  suit: SUITS[Math.floor(Math.random() * SUITS.length)],
});

export default function HiLoGame() {
  const { data: session } = useSession();

  const [bet, setBet] = useState(50000);
  const [balance, setBalance] = useState(0);
  const [gameState, setGameState] = useState<'setup' | 'playing' | 'won' | 'lost'>('setup');
  const [currentCard, setCurrentCard] = useState<Card | null>(null);
  const [nextCard, setNextCard] = useState<Card | null>(null);
  const [currentMultiplier, setCurrentMultiplier] = useState(1.0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ won: boolean; amount: number; multiplier: number } | null>(null);
  const [history, setHistory] = useState<{ multiplier: number; result: 'win' | 'lose' }[]>([]);
  const [cardHistory, setCardHistory] = useState<Card[]>([]);
  const [revealingNext, setRevealingNext] = useState(false);

  const MIN_BET = 3000;
  const MAX_BET = 500000000;

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
    const card = getRandomCard();
    setCurrentCard(card);
    setCardHistory([card]);
    setGameState('playing');
    setCurrentMultiplier(1.0);
    setResult(null);
    setLoading(false);
  };

  const makeGuess = async (prediction: 'higher' | 'lower') => {
    if (gameState !== 'playing' || !currentCard || loading) return;

    setLoading(true);
    setRevealingNext(true);

    // Simulate delay for card reveal
    await new Promise(resolve => setTimeout(resolve, 800));

    const next = getRandomCard();
    setNextCard(next);

    const currentValue = getCardValue(currentCard.rank);
    const nextValue = getCardValue(next.rank);

    let correct = false;
    if (prediction === 'higher') {
      correct = nextValue > currentValue;
    } else {
      correct = nextValue < currentValue;
    }

    if (!correct) {
      // Lost
      setGameState('lost');
      setResult({
        won: false,
        amount: 0,
        multiplier: currentMultiplier,
      });

      setHistory(prev => [
        { multiplier: currentMultiplier, result: 'lose' },
        ...prev.slice(0, 19),
      ]);

      try {
        await playHiLo(bet, cardHistory.length);
      } catch (err) {
        console.error('Failed to record game:', err);
      }
    } else {
      // Correct guess - chain continues
      const newMultiplier = currentMultiplier * 2;
      setCurrentMultiplier(newMultiplier);
      setCurrentCard(next);
      setCardHistory(prev => [...prev, next]);
      setNextCard(null);
      setRevealingNext(false);
    }

    setLoading(false);
  };

  const cashOut = async () => {
    if (gameState !== 'playing' || currentMultiplier <= 1) return;

    setGameState('won');
    const winAmount = Math.floor(bet * currentMultiplier);
    setBalance(prev => prev + winAmount);
    setResult({
      won: true,
      amount: winAmount,
      multiplier: currentMultiplier,
    });

    setHistory(prev => [
      { multiplier: currentMultiplier, result: 'win' },
      ...prev.slice(0, 19),
    ]);

    try {
      await playHiLo(bet, cardHistory.length);
    } catch (err) {
      console.error('Failed to record game:', err);
    }
  };

  const playAgain = () => {
    setGameState('setup');
    setCurrentCard(null);
    setNextCard(null);
    setResult(null);
    setCardHistory([]);
    setCurrentMultiplier(1.0);
    setRevealingNext(false);
    fetchBalance();
  };

  const renderCard = (card: Card | null, size: 'small' | 'large' = 'large') => {
    if (!card) {
      return (
        <div
          className={`bg-gradient-to-br from-slate-700 to-slate-800 rounded-lg border-2 border-purple-500/50 flex items-center justify-center ${
            size === 'large' ? 'w-24 h-32' : 'w-16 h-20'
          }`}
        >
          <div className="text-center">
            <div className="text-purple-400 text-xs">?</div>
          </div>
        </div>
      );
    }

    const isRed = card.suit === '♥' || card.suit === '♦';

    return (
      <div
        className={`${isRed ? 'bg-red-900' : 'bg-black'} rounded-lg border-2 ${isRed ? 'border-red-400' : 'border-gray-400'} flex flex-col items-center justify-center ${
          size === 'large' ? 'w-24 h-32' : 'w-16 h-20'
        }`}
      >
        <div className={`font-bold ${size === 'large' ? 'text-xl' : 'text-xs'} ${isRed ? 'text-red-400' : 'text-white'}`}>
          {card.rank}
        </div>
        <div className={`${size === 'large' ? 'text-2xl' : 'text-lg'} ${isRed ? 'text-red-400' : 'text-white'}`}>
          {card.suit}
        </div>
      </div>
    );
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
              <h1 className="text-2xl font-bold text-white">Hi-Lo</h1>
              <p className="text-sm text-gray-400">Predict the next card</p>
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

            {/* Game Area */}
            <div className="bg-slate-800/50 border border-purple-500/30 rounded-xl p-8 mb-6">
              <h2 className="text-lg font-bold text-white mb-8 text-center">Is the next card Higher or Lower?</h2>

              {/* Cards Display */}
              <div className="flex items-center justify-center gap-8 mb-12">
                {/* Current Card */}
                <div className="text-center">
                  <p className="text-gray-400 text-sm mb-3">Current Card</p>
                  {renderCard(currentCard, 'large')}
                  {currentCard && (
                    <p className="text-white font-semibold mt-3">Value: {getCardValue(currentCard.rank)}</p>
                  )}
                </div>

                {/* Arrow */}
                <div className="text-center">
                  <div className="text-purple-400 text-3xl font-bold">VS</div>
                  <p className="text-gray-400 text-xs mt-2">Next Card</p>
                </div>

                {/* Next Card */}
                <div className="text-center">
                  <p className="text-gray-400 text-sm mb-3">Next Card</p>
                  {revealingNext ? (
                    renderCard(nextCard, 'large')
                  ) : (
                    renderCard(null, 'large')
                  )}
                  {nextCard && revealingNext && (
                    <p className="text-white font-semibold mt-3">Value: {getCardValue(nextCard.rank)}</p>
                  )}
                </div>
              </div>

              {/* Multiplier Display */}
              <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-lg p-6 mb-8 border border-purple-500/30">
                <p className="text-gray-400 text-sm mb-2">Current Multiplier Chain</p>
                <p className="text-4xl font-bold text-purple-400">{currentMultiplier.toFixed(1)}x</p>
                <p className="text-gray-400 text-xs mt-2">Cards Guessed: {cardHistory.length - 1}</p>
              </div>

              {/* Result */}
              {result && (
                <div
                  className={`p-6 rounded-lg border mb-6 ${
                    result.won ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'
                  }`}
                >
                  <p className={`text-sm font-semibold mb-2 ${result.won ? 'text-green-400' : 'text-red-400'}`}>
                    {result.won ? 'YOU WON!' : 'INCORRECT GUESS!'}
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
              <h2 className="text-lg font-bold text-white mb-4">Game Control</h2>

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
                      disabled={loading || bet > balance}
                      className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-3 rounded-lg disabled:opacity-50 transition-all"
                    >
                      Start Game
                    </button>
                  )}

                  {gameState === 'playing' && (
                    <>
                      <button
                        onClick={() => makeGuess('higher')}
                        disabled={loading || revealingNext}
                        className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold py-3 rounded-lg disabled:opacity-50 transition-all"
                      >
                        Higher
                      </button>
                      <button
                        onClick={() => makeGuess('lower')}
                        disabled={loading || revealingNext}
                        className="w-full bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white font-bold py-3 rounded-lg disabled:opacity-50 transition-all"
                      >
                        Lower
                      </button>
                      <button
                        onClick={cashOut}
                        disabled={currentMultiplier <= 1 || loading || revealingNext}
                        className="w-full bg-gradient-to-r from-yellow-600 to-amber-600 hover:from-yellow-700 hover:to-amber-700 text-white font-bold py-3 rounded-lg disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                      >
                        <Zap size={20} />
                        Cash Out - {currentMultiplier.toFixed(1)}x
                      </button>
                    </>
                  )}

                  {(gameState === 'won' || gameState === 'lost') && (
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

            {/* Card History */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
              <h3 className="text-sm font-bold text-white mb-3">Card Sequence</h3>
              <div className="flex gap-1 flex-wrap">
                {cardHistory.map((card, i) => (
                  <div key={i} className="w-10 h-14 flex items-center justify-center rounded text-xs font-bold">
                    {renderCard(card, 'small')}
                  </div>
                ))}
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
                    <div key={i} className={`p-3 rounded-lg border ${
                      game.result === 'win' ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'
                    }`}>
                      <div className="flex items-center justify-between">
                        <p className={`text-xs font-semibold ${game.result === 'win' ? 'text-green-400' : 'text-red-400'}`}>
                          {game.result === 'win' ? 'WIN' : 'LOSE'}
                        </p>
                        <p className={`text-sm font-bold ${game.result === 'win' ? 'text-green-400' : 'text-red-400'}`}>
                          {game.multiplier.toFixed(1)}x
                        </p>
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
