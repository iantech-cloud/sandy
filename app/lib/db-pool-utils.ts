/**
 * Database Pool Utilities
 * Helps manage database connections efficiently to prevent pool exhaustion
 */

interface PoolTask<T> {
  name: string;
  execute: () => Promise<T>;
  retries?: number;
}

/**
 * Sequential query executor - runs database queries one at a time
 * to avoid exhausting connection pool during high-concurrency operations like activation
 * 
 * Use this instead of Promise.all() for database operations during critical flows
 * @param tasks Array of async database operations
 * @returns Array of results in same order as input tasks
 */
export async function executeSequentialQueries<T>(
  tasks: PoolTask<T>[]
): Promise<T[]> {
  const results: T[] = [];
  const errors: Error[] = [];

  for (const task of tasks) {
    let retries = task.retries ?? 0;
    let lastError: Error | null = null;

    while (retries >= 0) {
      try {
        console.log(`[Pool] Executing: ${task.name}`);
        const result = await task.execute();
        results.push(result);
        break;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        retries--;

        if (retries >= 0) {
          const delay = 500 * (task.retries! - retries); // Exponential backoff
          console.warn(`[Pool] ${task.name} failed, retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          console.error(`[Pool] ${task.name} failed after retries:`, lastError.message);
          errors.push(lastError);
        }
      }
    }
  }

  if (errors.length > 0) {
    throw new AggregateError(
      errors,
      `Sequential query execution failed: ${errors.map(e => e.message).join(', ')}`
    );
  }

  return results;
}

/**
 * Batch query executor - executes queries in configurable batch sizes
 * Useful for medium-concurrency operations
 * @param tasks Array of async database operations
 * @param batchSize Number of concurrent queries per batch (default: 5)
 */
export async function executeBatchQueries<T>(
  tasks: PoolTask<T>[],
  batchSize: number = 5
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  const errors: Error[] = [];

  for (let i = 0; i < tasks.length; i += batchSize) {
    const batch = tasks.slice(i, i + batchSize);
    const batchPromises = batch.map((task, idx) =>
      task
        .execute()
        .then(result => {
          results[i + idx] = result;
          console.log(`[Pool] Batch item ${i + idx + 1}/${tasks.length} completed: ${task.name}`);
        })
        .catch(error => {
          const err = error instanceof Error ? error : new Error(String(error));
          console.error(`[Pool] Batch item failed: ${task.name}`, err.message);
          errors.push(err);
        })
    );

    await Promise.all(batchPromises);
  }

  if (errors.length > 0) {
    throw new AggregateError(
      errors,
      `Batch query execution failed: ${errors.map(e => e.message).join(', ')}`
    );
  }

  return results;
}

/**
 * With connection retry - automatically retries a query if connection pool is exhausted
 * @param operation Database operation to execute
 * @param maxRetries Maximum number of retries (default: 3)
 * @param delayMs Delay between retries in milliseconds (default: 1000)
 */
export async function withConnectionRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if it's a connection pool timeout
      if (
        lastError.message.includes('timed out') ||
        lastError.message.includes('connection pool') ||
        lastError.message.includes('ECONNREFUSED')
      ) {
        if (attempt < maxRetries) {
          const backoffDelay = delayMs * Math.pow(1.5, attempt);
          console.warn(
            `[Pool] Connection issue on attempt ${attempt + 1}, retrying in ${backoffDelay}ms...`,
            lastError.message
          );
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
          continue;
        }
      }

      throw error;
    }
  }

  throw lastError || new Error('Unknown error in withConnectionRetry');
}

/**
 * Connection pool status checker
 * Helps diagnose connection pool health
 */
export function getConnectionPoolInfo(connection: any) {
  if (!connection || !connection.getClient) return null;

  try {
    const client = connection.getClient();
    const topology = client.topology;

    if (!topology) return null;

    return {
      poolSize: topology.pool?.totalConnectionCount ?? 0,
      availableConnections: topology.pool?.availableConnectionCount ?? 0,
      waitingRequests: topology.pool?.waitingRequestCount ?? 0,
      state: topology.state ?? 'unknown',
    };
  } catch (error) {
    console.warn('Could not get connection pool info:', error);
    return null;
  }
}
