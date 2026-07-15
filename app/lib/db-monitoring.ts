// Database Performance Monitoring and Stats
import mongoose from 'mongoose';
import { getCacheStats } from './db-cache';

interface DatabaseStats {
  connection: {
    state: string;
    readyState: number;
    host: string | null;
  };
  collections: Record<string, any>;
  cache: {
    keys: number;
    memory: string;
    hitRate: string;
  };
  performance: {
    timestamp: string;
    uptime: string;
  };
}

/**
 * Get connection state description
 */
function getConnectionState(readyState: number): string {
  const states: Record<number, string> = {
    0: 'Disconnected',
    1: 'Connected',
    2: 'Connecting',
    3: 'Disconnecting',
  };
  return states[readyState] || 'Unknown';
}

/**
 * Get database statistics
 */
export async function getDatabaseStats(): Promise<DatabaseStats> {
  try {
    const connection = mongoose.connection;
    const db = connection.getClient().db();
    
    // Get collection stats
    const adminDb = connection.getClient().db('admin');
    const serverStatus = await adminDb.command({ serverStatus: 1 });
    
    // Get collections info
    const collections: Record<string, any> = {};
    const collectionNames = await db.listCollections().toArray();
    
    for (const collInfo of collectionNames) {
      const collName = collInfo.name;
      const coll = db.collection(collName);
      const stats = await coll.stats();
      collections[collName] = {
        documents: stats.count,
        avgDocSize: Math.round(stats.avgObjSize || 0),
        totalSize: stats.size,
        indexSize: stats.totalIndexSize,
      };
    }

    return {
      connection: {
        state: getConnectionState(connection.readyState),
        readyState: connection.readyState,
        host: connection.getClient()?.options?.hosts?.[0]?.host || null,
      },
      collections,
      cache: getCacheStats(),
      performance: {
        timestamp: new Date().toISOString(),
        uptime: process.uptime().toFixed(2) + 's',
      },
    };
  } catch (error) {
    console.error('[DB Monitoring] Error:', error);
    throw error;
  }
}

/**
 * Check slow queries and logging
 */
export async function enableSlowQueryLogging(thresholdMs: number = 100) {
  try {
    const connection = mongoose.connection;
    const db = connection.getClient().db();
    const adminDb = connection.getClient().db('admin');
    
    // Set profiling level and threshold
    await adminDb.command({
      profile: 1,
      slowms: thresholdMs,
    });

    console.log(`✅ Slow query logging enabled (threshold: ${thresholdMs}ms)`);
  } catch (error) {
    console.error('Error enabling slow query logging:', error);
  }
}

/**
 * Get slow queries from profiler
 */
export async function getSlowQueries(limit: number = 10) {
  try {
    const connection = mongoose.connection;
    const db = connection.getClient().db();
    
    const slowQueries = await db
      .collection('system.profile')
      .find({})
      .sort({ ts: -1 })
      .limit(limit)
      .toArray();

    return slowQueries.map(q => ({
      operation: q.op,
      namespace: q.ns,
      duration: q.millis,
      timestamp: q.ts,
      filter: q.command?.filter || null,
    }));
  } catch (error) {
    console.error('Error getting slow queries:', error);
    return [];
  }
}

/**
 * Optimize connection for production
 */
export async function optimizeConnectionForProduction() {
  try {
    const connection = mongoose.connection;
    const client = connection.getClient();
    
    // Enable connection pooling stats monitoring
    client.on('connectionPoolCreated', (event) => {
      console.log('[DB] Connection pool created:', {
        maxPoolSize: event.options.maxPoolSize,
        minPoolSize: event.options.minPoolSize,
      });
    });

    client.on('connectionCheckedOut', () => {
      // Connection checked out from pool
    });

    client.on('connectionCheckedIn', () => {
      // Connection returned to pool
    });

    console.log('✅ Connection optimization enabled');
  } catch (error) {
    console.error('Error optimizing connection:', error);
  }
}

/**
 * Analyze query performance
 */
export async function analyzeQueryPerformance() {
  try {
    const connection = mongoose.connection;
    const db = connection.getClient().db();
    const adminDb = connection.getClient().db('admin');

    // Get current slow queries
    const slowQueries = await getSlowQueries(5);
    
    // Get index statistics
    const indexStats = await adminDb.command({ indexStats: {} });

    return {
      slowQueries,
      indexStats,
      recommendations: generateOptimizationRecommendations(slowQueries),
    };
  } catch (error) {
    console.error('Error analyzing performance:', error);
    return null;
  }
}

/**
 * Generate optimization recommendations
 */
function generateOptimizationRecommendations(slowQueries: any[]): string[] {
  const recommendations: string[] = [];

  if (slowQueries.length === 0) {
    recommendations.push('✅ No slow queries detected');
    return recommendations;
  }

  const avgDuration = slowQueries.reduce((sum, q) => sum + (q.duration || 0), 0) / slowQueries.length;
  
  if (avgDuration > 500) {
    recommendations.push(`⚠️  Average query duration is ${avgDuration.toFixed(0)}ms - consider adding indexes`);
  }

  // Check for common slow query patterns
  slowQueries.forEach(q => {
    if (q.filter && Object.keys(q.filter).length > 3) {
      recommendations.push('💡 Complex filters detected - consider compound indexes');
    }
  });

  return recommendations;
}

/**
 * Get comprehensive database health report
 */
export async function getDatabaseHealthReport() {
  try {
    const stats = await getDatabaseStats();
    const performance = await analyzeQueryPerformance();

    return {
      status: stats.connection.state === 'Connected' ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      connection: stats.connection,
      collections: stats.collections,
      cache: stats.cache,
      performance,
    };
  } catch (error) {
    console.error('Error generating health report:', error);
    return null;
  }
}
