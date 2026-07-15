// Optimized Database Queries with Lean, Select, and Caching
import { Profile, GamingWallet, GameResult, GamingTransaction, Transaction } from './models';
import { connectToDatabase } from './mongoose';
import { getCached, setCached, generateCacheKey, CACHE_TIMES } from './db-cache';

/**
 * Optimized User Query - Returns lean documents for fast serialization
 */
export async function findUserOptimized(userId: string) {
  const cacheKey = generateCacheKey('user', { userId });
  const cached = getCached(cacheKey);
  if (cached) return cached;

  await connectToDatabase();

  const user = await Profile.findById(userId)
    .lean() // Return plain JS objects instead of Mongoose documents
    .select('_id username email phone_number role is_active is_verified status rank')
    .exec();

  if (user) {
    setCached(cacheKey, user, CACHE_TIMES.USER);
  }
  return user;
}

/**
 * Optimized Gaming Wallet Query - Cached
 */
export async function findGamingWalletOptimized(userId: string) {
  const cacheKey = generateCacheKey('wallet', { userId });
  const cached = getCached(cacheKey);
  if (cached) return cached;

  await connectToDatabase();

  const wallet = await GamingWallet.findOne({ user_id: userId })
    .lean()
    .select('balance_cents total_deposited_cents total_lost_cents user_id updated_at')
    .exec();

  if (wallet) {
    setCached(cacheKey, wallet, CACHE_TIMES.WALLET);
  }
  return wallet;
}

/**
 * Optimized Recent Gaming Transactions - Paginated and cached
 */
export async function findRecentGamingTransactionsOptimized(
  userId: string,
  limit: number = 10,
  skip: number = 0
) {
  const cacheKey = generateCacheKey('gaming_transactions', { userId, limit, skip });
  const cached = getCached(cacheKey);
  if (cached) return cached;

  await connectToDatabase();

  const transactions = await GamingTransaction.find({ user_id: userId })
    .lean()
    .select('type amount_cents balance_after_cents status created_at')
    .sort({ created_at: -1 })
    .skip(skip)
    .limit(limit)
    .exec();

  if (transactions.length > 0) {
    setCached(cacheKey, transactions, CACHE_TIMES.TRANSACTION);
  }
  return transactions;
}

/**
 * Optimized Game History - Paginated
 */
export async function findGameHistoryOptimized(
  userId: string,
  gameType?: string,
  limit: number = 20,
  skip: number = 0
) {
  const cacheKey = generateCacheKey('game_history', { userId, gameType, limit, skip });
  const cached = getCached(cacheKey);
  if (cached) return cached;

  await connectToDatabase();

  const query = gameType 
    ? { user_id: userId, game_type: gameType }
    : { user_id: userId };

  const games = await GameResult.find(query)
    .lean()
    .select('game_type bet_amount_cents balance_after_cents duration_seconds created_at')
    .sort({ created_at: -1 })
    .skip(skip)
    .limit(limit)
    .exec();

  if (games.length > 0) {
    setCached(cacheKey, games, CACHE_TIMES.GAMING_STATS);
  }
  return games;
}

/**
 * Optimized Gaming Statistics
 */
export async function getGamingStatsOptimized(userId: string) {
  const cacheKey = generateCacheKey('gaming_stats', { userId });
  const cached = getCached(cacheKey);
  if (cached) return cached;

  await connectToDatabase();

  // Use aggregation pipeline for efficient stats calculation
  const stats = await GameResult.aggregate([
    { $match: { user_id: userId } },
    {
      $group: {
        _id: '$user_id',
        totalGames: { $sum: 1 },
        totalWagered: { $sum: '$bet_amount_cents' },
        totalLost: { $sum: '$bet_amount_cents' },
        avgBet: { $avg: '$bet_amount_cents' },
        avgDuration: { $avg: '$duration_seconds' }
      }
    },
    {
      $project: {
        _id: 0,
        totalGames: 1,
        totalWagered: 1,
        totalLost: 1,
        avgBet: { $round: ['$avgBet', 0] },
        avgDuration: { $round: ['$avgDuration', 1] }
      }
    }
  ]).exec();

  const result = stats[0] || { totalGames: 0, totalWagered: 0, totalLost: 0, avgBet: 0, avgDuration: 0 };
  setCached(cacheKey, result, CACHE_TIMES.GAMING_STATS);
  return result;
}

/**
 * Optimized Transaction History - For wallet
 */
export async function findTransactionHistoryOptimized(
  userId: string,
  limit: number = 15,
  skip: number = 0
) {
  const cacheKey = generateCacheKey('transaction_history', { userId, limit, skip });
  const cached = getCached(cacheKey);
  if (cached) return cached;

  await connectToDatabase();

  const transactions = await Transaction.find({ user_id: userId })
    .lean()
    .select('type amount_cents balance_before_cents balance_after_cents status created_at description')
    .sort({ created_at: -1 })
    .skip(skip)
    .limit(limit)
    .exec();

  if (transactions.length > 0) {
    setCached(cacheKey, transactions, CACHE_TIMES.TRANSACTION);
  }
  return transactions;
}

/**
 * Optimized Multi-user Query for Admin dashboards
 */
export async function findUsersOptimized(
  filter: any = {},
  limit: number = 50,
  skip: number = 0,
  sort: any = { created_at: -1 }
) {
  const cacheKey = generateCacheKey('users_list', { filter, limit, skip });
  const cached = getCached(cacheKey);
  if (cached) return cached;

  await connectToDatabase();

  const users = await Profile.find(filter)
    .lean()
    .select('_id username email phone_number role status rank is_active created_at')
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .exec();

  if (users.length > 0) {
    setCached(cacheKey, users, CACHE_TIMES.STATS);
  }
  return users;
}

/**
 * Count users with caching
 */
export async function countUsersOptimized(filter: any = {}) {
  const cacheKey = generateCacheKey('users_count', filter);
  const cached = getCached(cacheKey);
  if (cached) return cached;

  await connectToDatabase();

  const count = await Profile.countDocuments(filter).exec();
  setCached(cacheKey, count, CACHE_TIMES.STATS);
  return count;
}

/**
 * Batch get multiple users efficiently
 */
export async function findUsersInBatchOptimized(userIds: string[]) {
  await connectToDatabase();

  const users = await Profile.find({ _id: { $in: userIds } })
    .lean()
    .select('_id username email role status')
    .exec();

  return users;
}

/**
 * Get user with full profile including wallet
 */
export async function findUserWithWalletOptimized(userId: string) {
  const cacheKey = generateCacheKey('user_wallet', { userId });
  const cached = getCached(cacheKey);
  if (cached) return cached;

  await connectToDatabase();

  const [user, wallet] = await Promise.all([
    Profile.findById(userId)
      .lean()
      .select('_id username email role is_active'),
    GamingWallet.findOne({ user_id: userId })
      .lean()
      .select('balance_cents total_lost_cents')
  ]);

  const result = { user, wallet };
  if (user && wallet) {
    setCached(cacheKey, result, CACHE_TIMES.USER);
  }
  return result;
}
