import { connectToDatabase } from './mongoose';

let isWarmed = false;
let warmupPromise: Promise<void> | null = null;

/**
 * Pre-warm MongoDB connection at startup to avoid cold starts
 * Runs in background and caches the connection
 */
export async function warmupDatabaseConnection(): Promise<void> {
  if (isWarmed) return;
  if (warmupPromise) return warmupPromise;

  warmupPromise = (async () => {
    try {
      await connectToDatabase();
      isWarmed = true;
      console.log('[v0] Database connection warmed up');
    } catch (error) {
      console.error('[v0] Database warmup failed:', error instanceof Error ? error.message : 'Unknown');
      warmupPromise = null; // Allow retry
    }
  })();

  return warmupPromise;
}

/**
 * Check if connection is ready without blocking
 */
export function isConnectionReady(): boolean {
  return isWarmed;
}

/**
 * Reset warmup state (for testing)
 */
export function resetWarmup(): void {
  isWarmed = false;
  warmupPromise = null;
}
