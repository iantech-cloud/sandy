// lib/cache.js
import { unstable_cache } from 'next/cache';

export const getCachedBlogPosts = unstable_cache(
  async (page = 1, limit = 9) => {
    await connectToDatabase();
    const skip = (page - 1) * limit;
    
    return BlogPost.find({ status: 'published' })
      .populate('author', 'username name')
      .sort({ published_at: -1, created_at: -1 })
      .skip(skip)
      .limit(limit)
      .select('_id title slug excerpt featured_image tags read_time created_at author')
      .lean();
  },
  ['blog-posts'],
  { revalidate: 3600 } // 1 hour cache
);

export const getCachedBlogPost = unstable_cache(
  async (slug: string) => {
    await connectToDatabase();
    return BlogPost.findOne({ slug, status: 'published' })
      .populate('author', 'username name')
      .select('_id title slug content excerpt featured_image tags read_time views created_at updated_at published_at author meta_title meta_description')
      .lean();
  },
  ['blog-post'],
  { revalidate: 3600 }
);

/**
 * Simple in-memory cache for server-side operations
 * Automatically invalidates entries after TTL
 */
interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class MemoryCache {
  private store: Map<string, CacheEntry<any>> = new Map();

  set<T>(key: string, value: T, ttlMs: number = 5 * 60 * 1000): void {
    const expiresAt = Date.now() + ttlMs;
    this.store.set(key, { value, expiresAt });
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  has(key: string): boolean {
    const entry = this.store.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return false;
    }
    return true;
  }

  delete(key: string): boolean {
    return this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  size(): number {
    return this.store.size;
  }

  cleanup(): number {
    let removed = 0;
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
        removed++;
      }
    }
    return removed;
  }
}

// Singleton cache instance
export const appCache = new MemoryCache();

// Cache key generators
export const cacheKeys = {
  referrals: (userId: string, page: number) => `referrals:${userId}:page${page}`,
  referralStats: (userId: string) => `referral-stats:${userId}`,
  unreadCount: (userId: string) => `unread-count:${userId}`,
  notifications: (userId: string, page: number) => `notifications:${userId}:page${page}`,
};

// Cache TTL constants (in milliseconds)
export const cacheTTL = {
  SHORT: 30 * 1000, // 30 seconds
  MEDIUM: 2 * 60 * 1000, // 2 minutes
  LONG: 5 * 60 * 1000, // 5 minutes
};
