/**
 * Simple in-memory rate limiter.
 * For multi-instance / serverless deployments consider swapping the store for
 * Upstash Redis — the interface is identical.
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Rate-limit a request.
 * @param identifier - Unique key (e.g. `userId`, `ip`, or a composite)
 * @param limit      - Max requests allowed in the window
 * @param windowMs   - Window length in milliseconds
 */
export function rateLimit(
  identifier: string,
  limit: number = 60,
  windowMs: number = 60_000
): { remaining: number; exceeded: boolean; resetTime: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  if (!entry || now > entry.resetTime) {
    const resetTime = now + windowMs;
    rateLimitStore.set(identifier, { count: 1, resetTime });
    return { remaining: limit - 1, exceeded: false, resetTime };
  }

  entry.count++;
  const remaining = Math.max(0, limit - entry.count);
  const exceeded = entry.count > limit;
  return { remaining, exceeded, resetTime: entry.resetTime };
}

// ─────────────────────────────────────────────────────────────────────────────
// Named limit presets — import and reuse across route handlers
// ─────────────────────────────────────────────────────────────────────────────
export const API_RATE_LIMITS = {
  // Notifications
  notifications:    { limit: 100, windowMs: 60_000 },
  // Referrals
  referrals:        { limit: 50,  windowMs: 60_000 },
  // Financial / payment endpoints — tighter to prevent abuse
  transactions:     { limit: 30,  windowMs: 60_000 },
  payments:         { limit: 10,  windowMs: 60_000 },  // STK push / unlock
  mpesa:            { limit: 10,  windowMs: 60_000 },
  // Auth endpoints
  auth:             { limit: 10,  windowMs: 60_000 },  // login / register / 2FA
  // Chat Foreigners
  cfChat:           { limit: 30,  windowMs: 60_000 },  // message send
  cfHistory:        { limit: 60,  windowMs: 60_000 },  // history GET
  cfBots:           { limit: 60,  windowMs: 60_000 },  // bot listing / details
  cfWallet:         { limit: 30,  windowMs: 60_000 },
  cfProfile:        { limit: 30,  windowMs: 60_000 },
  // Admin endpoints (higher tolerance — internal use)
  admin:            { limit: 200, windowMs: 60_000 },
  // Spin wheel
  spin:             { limit: 5,   windowMs: 60_000 },  // 5 spins per minute
  // Reports / analytics reads
  reports:          { limit: 20,  windowMs: 60_000 },
  // General fallback
  general:          { limit: 120, windowMs: 60_000 },
};

/**
 * Helper: return a 429 NextResponse with standard headers.
 */
export function rateLimitResponse(resetTime: number) {
  const { NextResponse } = require('next/server');
  return NextResponse.json(
    { success: false, error: 'Too many requests. Please slow down and try again.' },
    {
      status: 429,
      headers: {
        'Retry-After': String(Math.ceil((resetTime - Date.now()) / 1000)),
        'X-RateLimit-Reset': String(resetTime),
      },
    }
  );
}

// Clean up expired entries every 5 minutes to prevent memory leaks
export function cleanupRateLimitStore() {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) rateLimitStore.delete(key);
  }
}
setInterval(cleanupRateLimitStore, 5 * 60_000);
