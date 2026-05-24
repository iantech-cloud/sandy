/**
 * Simple in-memory rate limiter
 * In production, consider using Redis or Upstash Redis for distributed rate limiting
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Rate limit a request
 * @param identifier - Unique identifier (e.g., user ID, IP address)
 * @param limit - Max requests allowed
 * @param windowMs - Time window in milliseconds
 * @returns Object with remaining requests and whether limit exceeded
 */
export function rateLimit(
  identifier: string,
  limit: number = 60,
  windowMs: number = 60 * 1000 // 1 minute default
): { remaining: number; exceeded: boolean; resetTime: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  if (!entry || now > entry.resetTime) {
    // Create new entry
    const resetTime = now + windowMs;
    rateLimitStore.set(identifier, { count: 1, resetTime });
    return { remaining: limit - 1, exceeded: false, resetTime };
  }

  // Update existing entry
  entry.count++;
  const remaining = Math.max(0, limit - entry.count);
  const exceeded = entry.count > limit;

  return { remaining, exceeded, resetTime: entry.resetTime };
}

/**
 * Rate limit for API endpoints - 100 requests per minute per user
 */
export const API_RATE_LIMITS = {
  notifications: { limit: 100, windowMs: 60 * 1000 }, // 100 per minute
  referrals: { limit: 50, windowMs: 60 * 1000 }, // 50 per minute
  transactions: { limit: 50, windowMs: 60 * 1000 }, // 50 per minute
  general: { limit: 200, windowMs: 60 * 1000 }, // 200 per minute
};

/**
 * Clean up old entries (run periodically)
 */
export function cleanupRateLimitStore() {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

// Clean up every 5 minutes
setInterval(cleanupRateLimitStore, 5 * 60 * 1000);
