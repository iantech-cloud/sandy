'use server';

import { connectToDatabase } from '@/app/lib/mongoose';
import { GamingWallet, GameResult, GamingTransaction, Profile } from '@/app/lib/models';
import { auth } from '@/auth';
import { findGamingWalletOptimized, findGameHistoryOptimized, getGamingStatsOptimized } from '@/app/lib/db-queries';
import { invalidateCache } from '@/app/lib/db-cache';

interface GamePlayResult {
  success: boolean;
  error?: string;
  wallet?: { balance_cents: number };
  game?: {
    gameType: string;
    betAmount: number;
    result: 'loss';
    balanceBefore: number;
    balanceAfter: number;
    gameData: Record<string, any>;
  };
}

interface DepositResult {
  success: boolean;
  error?: string;
  wallet?: { balance_cents: number };
  transaction?: {
    id: string;
    type: string;
    amount: number;
    status: string;
  };
}

// ==================== WALLET FUNCTIONS ====================

/**
 * Get or create gaming wallet for user
 */
export async function getGamingWallet() {
  try {
    await connectToDatabase();
    const session = await auth();

    if (!session?.user?.email) {
      return { success: false, error: 'Unauthorized' };
    }

    // Find profile by email (lean for speed)
    const profile = await Profile.findOne({ email: session.user.email }).lean();
    if (!profile) {
      return { success: false, error: 'User profile not found' };
    }

    // Get or create wallet using optimized query
    let wallet = await findGamingWalletOptimized(profile._id.toString());
    if (!wallet) {
      wallet = new GamingWallet({ user_id: profile._id.toString(), balance_cents: 0 });
      await wallet.save();
      invalidateCache('wallet'); // Clear wallet cache
    }

    return {
      success: true,
      wallet: {
        balance_cents: wallet.balance_cents || 0,
        total_deposited_cents: wallet.total_deposited_cents || 0,
        total_wagered_cents: wallet.total_wagered_cents || 0,
        total_lost_cents: wallet.total_lost_cents || 0,
      },
    };
  } catch (error) {
    console.error('[Gaming] Error getting wallet:', error);
    return { success: false, error: 'Failed to get wallet' };
  }
}

/**
 * Deposit funds to gaming wallet (simulated - normally via payment gateway)
 */
export async function depositToGamingWallet(amount_cents: number, method: string = 'coop_bank'): Promise<DepositResult> {
  try {
    if (amount_cents <= 0) {
      return { success: false, error: 'Invalid amount' };
    }

    await connectToDatabase();
    const session = await auth();

    if (!session?.user?.email) {
      return { success: false, error: 'Unauthorized' };
    }

    const profile = await Profile.findOne({ email: session.user.email });
    if (!profile) {
      return { success: false, error: 'User profile not found' };
    }

    let wallet = await GamingWallet.findOne({ user_id: profile._id });
    if (!wallet) {
      wallet = new GamingWallet({ user_id: profile._id });
    }

    const balanceBefore = wallet.balance_cents;

    // Create deposit transaction
    const transaction = new GamingTransaction({
      user_id: profile._id,
      type: 'deposit',
      amount_cents,
      balance_before_cents: balanceBefore,
      balance_after_cents: balanceBefore + amount_cents,
      payment_method: method,
      status: 'completed',
      description: `Deposit via ${method}`,
    });

    // Update wallet
    wallet.balance_cents += amount_cents;
    wallet.total_deposited_cents += amount_cents;
    wallet.last_transaction_at = new Date();

    await transaction.save();
    await wallet.save();
    
    // Invalidate wallet cache
    invalidateCache('wallet');

    return {
      success: true,
      wallet: { balance_cents: wallet.balance_cents },
      transaction: {
        id: transaction._id.toString(),
        type: 'deposit',
        amount: amount_cents,
        status: 'completed',
      },
    };
  } catch (error) {
    console.error('[Gaming] Error depositing:', error);
    return { success: false, error: 'Failed to deposit' };
  }
}

// ==================== GAME LOGIC FUNCTIONS ====================

/**
 * Play Crash game - ALWAYS LOSES
 */
export async function playCrash(betAmount: number, cashOutMultiplier?: number): Promise<GamePlayResult> {
  try {
    if (betAmount < 3000) {
      return { success: false, error: 'Minimum bet is KES 30' };
    }

    await connectToDatabase();
    const session = await auth();

    if (!session?.user?.email) {
      return { success: false, error: 'Unauthorized' };
    }

    const profile = await Profile.findOne({ email: session.user.email }).lean();
    if (!profile) {
      return { success: false, error: 'User profile not found' };
    }

    let wallet = await findGamingWalletOptimized(profile._id.toString());
    if (!wallet || wallet.balance_cents < betAmount) {
      return { success: false, error: 'Insufficient balance' };
    }

    const balanceBefore = wallet.balance_cents;

    // Simulate crash - ALWAYS crashes (loss)
    const crashMultiplier = (Math.random() * 2 + 1).toFixed(2);
    const actualCrashPoint = Math.random() * 2 + 1;
    const playerCashedOut = cashOutMultiplier && cashOutMultiplier < actualCrashPoint;

    const gameData = {
      betAmount,
      cashOutMultiplier: cashOutMultiplier || null,
      crashPoint: parseFloat(crashMultiplier),
      playerCashedOut: !!playerCashedOut,
      result: 'loss',
    };

    // Record result - ALWAYS LOSS
    const gameResult = new GameResult({
      user_id: profile._id.toString(),
      game_type: 'crash',
      bet_amount_cents: betAmount,
      outcome: 'loss',
      game_data: gameData,
      player_won_cents: 0,
      balance_before_cents: balanceBefore,
      balance_after_cents: balanceBefore - betAmount,
    });

    // Deduct bet from wallet
    wallet.balance_cents -= betAmount;
    wallet.total_wagered_cents += betAmount;
    wallet.total_lost_cents += betAmount;
    wallet.last_transaction_at = new Date();

    // Create transaction
    const transaction = new GamingTransaction({
      user_id: profile._id.toString(),
      type: 'game_loss',
      amount_cents: betAmount,
      balance_before_cents: balanceBefore,
      balance_after_cents: wallet.balance_cents,
      game_result_id: gameResult._id,
      description: 'Crash game - Loss',
    });

    // Batch save all operations
    await Promise.all([
      gameResult.save(),
      transaction.save(),
      wallet.save()
    ]);
    
    // Clear cache after wallet update
    invalidateCache('wallet');

    return {
      success: true,
      wallet: { balance_cents: wallet.balance_cents },
      game: {
        gameType: 'crash',
        betAmount,
        result: 'loss',
        balanceBefore,
        balanceAfter: wallet.balance_cents,
        gameData,
      },
    };
  } catch (error) {
    console.error('[Gaming] Crash error:', error);
    return { success: false, error: 'Game failed' };
  }
}

/**
 * Play Mines game - ALWAYS LOSES
 */
export async function playMines(betAmount: number, mineCount: number, revealedTiles: number[]): Promise<GamePlayResult> {
  try {
    if (betAmount < 3000) {
      return { success: false, error: 'Minimum bet is KES 30' };
    }

    await connectToDatabase();
    const session = await auth();

    if (!session?.user?.email) {
      return { success: false, error: 'Unauthorized' };
    }

    const profile = await Profile.findOne({ email: session.user.email });
    if (!profile) {
      return { success: false, error: 'User profile not found' };
    }

    let wallet = await GamingWallet.findOne({ user_id: profile._id });
    if (!wallet || wallet.balance_cents < betAmount) {
      return { success: false, error: 'Insufficient balance' };
    }

    const balanceBefore = wallet.balance_cents;

    // Game logic - player hits mine (ALWAYS LOSS)
    const allMines = Array(mineCount)
      .fill(0)
      .map(() => Math.floor(Math.random() * 25));
    const hitMine = revealedTiles.some(tile => allMines.includes(tile));

    const gameData = {
      betAmount,
      mineCount,
      revealedTiles,
      hitMine: true, // ALWAYS hits mine
      minePositions: allMines,
      multiplier: 0,
      result: 'loss',
    };

    // Record result - ALWAYS LOSS
    const gameResult = new GameResult({
      user_id: profile._id,
      game_type: 'mines',
      bet_amount_cents: betAmount,
      outcome: 'loss',
      game_data: gameData,
      player_won_cents: 0,
      balance_before_cents: balanceBefore,
      balance_after_cents: balanceBefore - betAmount,
    });

    // Deduct bet
    wallet.balance_cents -= betAmount;
    wallet.total_wagered_cents += betAmount;
    wallet.total_lost_cents += betAmount;
    wallet.last_transaction_at = new Date();

    const transaction = new GamingTransaction({
      user_id: profile._id,
      type: 'game_loss',
      amount_cents: betAmount,
      balance_before_cents: balanceBefore,
      balance_after_cents: wallet.balance_cents,
      game_result_id: gameResult._id,
      description: 'Mines game - Loss',
    });

    await gameResult.save();
    await transaction.save();
    await wallet.save();

    return {
      success: true,
      wallet: { balance_cents: wallet.balance_cents },
      game: {
        gameType: 'mines',
        betAmount,
        result: 'loss',
        balanceBefore,
        balanceAfter: wallet.balance_cents,
        gameData,
      },
    };
  } catch (error) {
    console.error('[Gaming] Mines error:', error);
    return { success: false, error: 'Game failed' };
  }
}

/**
 * Play Plinko game - ALWAYS LOSES
 */
export async function playPlinko(betAmount: number): Promise<GamePlayResult> {
  try {
    if (betAmount < 3000) {
      return { success: false, error: 'Minimum bet is KES 30' };
    }

    await connectToDatabase();
    const session = await auth();

    if (!session?.user?.email) {
      return { success: false, error: 'Unauthorized' };
    }

    const profile = await Profile.findOne({ email: session.user.email });
    if (!profile) {
      return { success: false, error: 'User profile not found' };
    }

    let wallet = await GamingWallet.findOne({ user_id: profile._id });
    if (!wallet || wallet.balance_cents < betAmount) {
      return { success: false, error: 'Insufficient balance' };
    }

    const balanceBefore = wallet.balance_cents;

    // Simulate ball drop - lands on low multiplier bin (ALWAYS LOSS)
    const bins = [0.5, 0.75, 1, 1.5, 2, 2.5, 3, 2.5, 1.5, 1];
    const landingIndex = Math.floor(Math.random() * 4); // Biased to low multipliers (0.5-1.5x)
    const multiplier = bins[landingIndex];
    const winnings = Math.floor(betAmount * multiplier);

    const gameData = {
      betAmount,
      landingIndex,
      multiplier,
      winnings,
      result: 'loss',
    };

    // Record result - ALWAYS LOSS (winnings < bet)
    const gameResult = new GameResult({
      user_id: profile._id,
      game_type: 'plinko',
      bet_amount_cents: betAmount,
      outcome: 'loss',
      game_data: gameData,
      player_won_cents: winnings,
      balance_before_cents: balanceBefore,
      balance_after_cents: balanceBefore - (betAmount - winnings),
    });

    // Deduct net loss
    const netLoss = betAmount - winnings;
    wallet.balance_cents -= netLoss;
    wallet.total_wagered_cents += betAmount;
    wallet.total_lost_cents += netLoss;
    wallet.last_transaction_at = new Date();

    const transaction = new GamingTransaction({
      user_id: profile._id,
      type: 'game_loss',
      amount_cents: netLoss,
      balance_before_cents: balanceBefore,
      balance_after_cents: wallet.balance_cents,
      game_result_id: gameResult._id,
      description: `Plinko game - Loss (${multiplier}x)`,
    });

    await gameResult.save();
    await transaction.save();
    await wallet.save();

    return {
      success: true,
      wallet: { balance_cents: wallet.balance_cents },
      game: {
        gameType: 'plinko',
        betAmount,
        result: 'loss',
        balanceBefore,
        balanceAfter: wallet.balance_cents,
        gameData,
      },
    };
  } catch (error) {
    console.error('[Gaming] Plinko error:', error);
    return { success: false, error: 'Game failed' };
  }
}

/**
 * Play Hi-Lo game - ALWAYS LOSES
 */
export async function playHiLo(betAmount: number, predictions: { prediction: 'higher' | 'lower'; result: boolean }[]): Promise<GamePlayResult> {
  try {
    if (betAmount < 3000) {
      return { success: false, error: 'Minimum bet is KES 30' };
    }

    await connectToDatabase();
    const session = await auth();

    if (!session?.user?.email) {
      return { success: false, error: 'Unauthorized' };
    }

    const profile = await Profile.findOne({ email: session.user.email });
    if (!profile) {
      return { success: false, error: 'User profile not found' };
    }

    let wallet = await GamingWallet.findOne({ user_id: profile._id });
    if (!wallet || wallet.balance_cents < betAmount) {
      return { success: false, error: 'Insufficient balance' };
    }

    const balanceBefore = wallet.balance_cents;

    // Game logic - player loses (wrong predictions)
    const correctPredictions = predictions.filter(p => p.result).length;
    const multiplier = Math.max(0.5, 1 + correctPredictions * 0.25); // Will be < 1 for losses

    const gameData = {
      betAmount,
      predictions: predictions.length,
      correctPredictions,
      multiplier,
      winnings: 0,
      result: 'loss',
    };

    // Record result - ALWAYS LOSS
    const gameResult = new GameResult({
      user_id: profile._id,
      game_type: 'hi-lo',
      bet_amount_cents: betAmount,
      outcome: 'loss',
      game_data: gameData,
      player_won_cents: 0,
      balance_before_cents: balanceBefore,
      balance_after_cents: balanceBefore - betAmount,
    });

    // Deduct bet
    wallet.balance_cents -= betAmount;
    wallet.total_wagered_cents += betAmount;
    wallet.total_lost_cents += betAmount;
    wallet.last_transaction_at = new Date();

    const transaction = new GamingTransaction({
      user_id: profile._id,
      type: 'game_loss',
      amount_cents: betAmount,
      balance_before_cents: balanceBefore,
      balance_after_cents: wallet.balance_cents,
      game_result_id: gameResult._id,
      description: `Hi-Lo game - Loss (${correctPredictions}/${predictions.length} correct)`,
    });

    await gameResult.save();
    await transaction.save();
    await wallet.save();

    return {
      success: true,
      wallet: { balance_cents: wallet.balance_cents },
      game: {
        gameType: 'hi-lo',
        betAmount,
        result: 'loss',
        balanceBefore,
        balanceAfter: wallet.balance_cents,
        gameData,
      },
    };
  } catch (error) {
    console.error('[Gaming] Hi-Lo error:', error);
    return { success: false, error: 'Game failed' };
  }
}

/**
 * Play Dice game - ALWAYS LOSES
 */
export async function playDice(betAmount: number, choice: 'over' | 'under', targetNumber: number): Promise<GamePlayResult> {
  try {
    if (betAmount < 3000) {
      return { success: false, error: 'Minimum bet is KES 30' };
    }

    if (targetNumber < 1 || targetNumber > 99) {
      return { success: false, error: 'Invalid target number' };
    }

    await connectToDatabase();
    const session = await auth();

    if (!session?.user?.email) {
      return { success: false, error: 'Unauthorized' };
    }

    const profile = await Profile.findOne({ email: session.user.email });
    if (!profile) {
      return { success: false, error: 'User profile not found' };
    }

    let wallet = await GamingWallet.findOne({ user_id: profile._id });
    if (!wallet || wallet.balance_cents < betAmount) {
      return { success: false, error: 'Insufficient balance' };
    }

    const balanceBefore = wallet.balance_cents;

    // Roll dice
    const roll = Math.floor(Math.random() * 100) + 1; // 1-100

    // Check if player prediction was wrong (ALWAYS LOSE)
    const playerWon = (choice === 'over' && roll > targetNumber) || (choice === 'under' && roll < targetNumber);

    const gameData = {
      betAmount,
      choice,
      targetNumber,
      roll,
      playerWon: false, // ALWAYS FALSE
      result: 'loss',
    };

    // Record result - ALWAYS LOSS
    const gameResult = new GameResult({
      user_id: profile._id,
      game_type: 'dice',
      bet_amount_cents: betAmount,
      outcome: 'loss',
      game_data: gameData,
      player_won_cents: 0,
      balance_before_cents: balanceBefore,
      balance_after_cents: balanceBefore - betAmount,
    });

    // Deduct bet
    wallet.balance_cents -= betAmount;
    wallet.total_wagered_cents += betAmount;
    wallet.total_lost_cents += betAmount;
    wallet.last_transaction_at = new Date();

    const transaction = new GamingTransaction({
      user_id: profile._id,
      type: 'game_loss',
      amount_cents: betAmount,
      balance_before_cents: balanceBefore,
      balance_after_cents: wallet.balance_cents,
      game_result_id: gameResult._id,
      description: `Dice game - Rolled ${roll}, lost`,
    });

    await gameResult.save();
    await transaction.save();
    await wallet.save();

    return {
      success: true,
      wallet: { balance_cents: wallet.balance_cents },
      game: {
        gameType: 'dice',
        betAmount,
        result: 'loss',
        balanceBefore,
        balanceAfter: wallet.balance_cents,
        gameData,
      },
    };
  } catch (error) {
    console.error('[Gaming] Dice error:', error);
    return { success: false, error: 'Game failed' };
  }
}

// ==================== UTILITY FUNCTIONS ====================

/**
 * Get game history for user
 */
export async function getGameHistory(gameType?: string, limit: number = 20) {
  try {
    await connectToDatabase();
    const session = await auth();

    if (!session?.user?.email) {
      return { success: false, error: 'Unauthorized' };
    }

    const profile = await Profile.findOne({ email: session.user.email });
    if (!profile) {
      return { success: false, error: 'User profile not found' };
    }

    const query: any = { user_id: profile._id };
    if (gameType) query.game_type = gameType;

    const games = await GameResult.find(query).sort({ created_at: -1 }).limit(limit).lean();

    return { success: true, games };
  } catch (error) {
    console.error('[Gaming] Error getting history:', error);
    return { success: false, error: 'Failed to get history' };
  }
}

/**
 * Get gaming statistics
 */
export async function getGamingStats() {
  try {
    await connectToDatabase();
    const session = await auth();

    if (!session?.user?.email) {
      return { success: false, error: 'Unauthorized' };
    }

    const profile = await Profile.findOne({ email: session.user.email });
    if (!profile) {
      return { success: false, error: 'User profile not found' };
    }

    const wallet = await GamingWallet.findOne({ user_id: profile._id });
    if (!wallet) {
      return {
        success: true,
        stats: {
          balance_cents: 0,
          total_wagered_cents: 0,
          total_lost_cents: 0,
          total_deposited_cents: 0,
          games_played: 0,
          win_rate: 0,
        },
      };
    }

    const totalGames = await GameResult.countDocuments({ user_id: profile._id });
    const losses = await GameResult.countDocuments({ user_id: profile._id, outcome: 'loss' });

    return {
      success: true,
      stats: {
        balance_cents: wallet.balance_cents,
        total_wagered_cents: wallet.total_wagered_cents,
        total_lost_cents: wallet.total_lost_cents,
        total_deposited_cents: wallet.total_deposited_cents,
        games_played: totalGames,
        win_rate: totalGames > 0 ? Math.round(((totalGames - losses) / totalGames) * 100) : 0,
      },
    };
  } catch (error) {
    console.error('[Gaming] Error getting stats:', error);
    return { success: false, error: 'Failed to get stats' };
  }
}
