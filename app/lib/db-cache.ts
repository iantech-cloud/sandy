// Database Caching and Query Optimization Layer
import NodeCache from 'node-cache';

// Initialize cache with 5-minute TTL (300 seconds)
const queryCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

/**
 * Cache configuration by query type
 */
export const CACHE_TIMES = {
  USER: 300, // 5 minutes for user profiles
  WALLET: 120, // 2 minutes for wallet balances
  GAMING_STATS: 180, // 3 minutes for gaming stats
  TRANSACTION: 60, // 1 minute for recent transactions
  REFERRAL: 300, // 5 minutes for referral data
  STATS: 600, // 10 minutes for analytics/stats
  SHORT: 30, // 30 seconds for frequently changing data
};

/**
 * Generate cache key from query parameters
 */
export function generateCacheKey(prefix: string, params: any): string {
  const paramStr = JSON.stringify(params).replace(/\s/g, '');
  return `${prefix}:${paramStr}`;
}

/**
 * Get cached value
 */
export function getCached<T>(key: string): T | undefined {
  return queryCache.get<T>(key);
}

/**
 * Set cached value
 */
export function setCached<T>(key: string, value: T, ttl?: number): void {
  queryCache.set(key, value, ttl || CACHE_TIMES.SHORT);
}

/**
 * Invalidate cache by prefix (useful for clearing related cache keys)
 */
export function invalidateCache(keyPrefix?: string): void {
  if (keyPrefix) {
    const keys = queryCache.keys();
    keys.forEach(key => {
      if (key.startsWith(keyPrefix)) {
        queryCache.del(key);
      }
    });
  } else {
    queryCache.flushAll();
  }
}

/**
 * Decorator for automatically caching query results
 */
export function withCache<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  cacheKeyPrefix: string,
  ttl: number = CACHE_TIMES.SHORT
) {
  return async (...args: T): Promise<R> => {
    const cacheKey = generateCacheKey(cacheKeyPrefix, args);
    
    // Check cache first
    const cached = getCached<R>(cacheKey);
    if (cached !== undefined) {
      console.log(`[v0] Cache hit: ${cacheKeyPrefix}`);
      return cached;
    }

    // Execute function
    const result = await fn(...args);
    
    // Cache result
    setCached(cacheKey, result, ttl);
    console.log(`[v0] Cache set: ${cacheKeyPrefix} (TTL: ${ttl}s)`);
    
    return result;
  };
}

/**
 * Get cache stats for monitoring
 */
export function getCacheStats() {
  return {
    keys: queryCache.keys().length,
    memory: Math.round(queryCache.getStats().ksize / 1024) + ' KB',
    hits: queryCache.getStats().hits,
    misses: queryCache.getStats().misses,
    hitRate: queryCache.getStats().hits + queryCache.getStats().misses > 0
      ? (queryCache.getStats().hits / (queryCache.getStats().hits + queryCache.getStats().misses) * 100).toFixed(2) + '%'
      : 'N/A',
  };
}
