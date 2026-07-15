import mongoose, { type Connection } from "mongoose"

interface MongooseCache {
  conn: Connection | null
  promise: Promise<typeof mongoose> | null
}

// MONGODB_URI is read lazily inside connectToDatabase() so that simply importing
// this module (e.g. during Next.js page-data collection at build time) does not
// throw when the env var is not yet injected. The check is enforced on first
// actual connection attempt.

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development. This prevents connections growing exponentially during API route
 * usage.
 */
declare global {
  var myMongoose: MongooseCache | undefined
}

const cached: MongooseCache = global.myMongoose || { conn: null, promise: null }

if (!global.myMongoose) {
  global.myMongoose = cached
}

/**
 * Connects to MongoDB using Mongoose.
 * This function utilizes connection pooling/caching to be efficient in a serverless environment.
 *
 * @returns {Promise<Connection>} The cached Mongoose connection
 * @throws {Error} If connection fails or MONGODB_URI is not defined
 */
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second between retries

async function connectWithRetry(uri: string, opts: any, retryCount = 0): Promise<typeof mongoose> {
  try {
    const mongooseInstance = await mongoose.connect(uri, opts);
    console.log('✅ MongoDB connected successfully');
    return mongooseInstance;
  } catch (error) {
    if (retryCount < MAX_RETRIES) {
      console.warn(`⚠️ Connection attempt ${retryCount + 1} failed, retrying in ${RETRY_DELAY}ms...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return connectWithRetry(uri, opts, retryCount + 1);
    }
    throw error;
  }
}

export async function connectToDatabase(): Promise<Connection> {
  // If connection is already cached and ready, return it immediately
  if (cached.conn && cached.conn.readyState === 1) {
    return cached.conn;
  }

  // If connection exists but is not ready, wait for it
  if (cached.conn && cached.conn.readyState !== 1) {
    console.log('⏳ Connection exists but not ready, waiting...');
    await new Promise(resolve => setTimeout(resolve, 500));
    if (cached.conn.readyState === 1) {
      return cached.conn;
    }
  }

  // Lazy env-var check: only fail when actually trying to connect.
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    throw new Error(
      "Please define the MONGODB_URI environment variable in your .env or .env.local file",
    );
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 5000, // Fast selection (5s)
      socketTimeoutMS: 10000, // Quick socket timeout (10s)
      maxPoolSize: 3, // Minimal pool to reduce overhead
      minPoolSize: 1,
      maxIdleTimeMS: 5000, // Close idle connections immediately
      connectTimeoutMS: 5000, // Fast connect timeout (5s)
      family: 4, // Use IPv4 only
      retryWrites: true,
      retryReads: true,
      waitQueueTimeoutMS: 5000, // Fail fast if queue is full
      authSource: 'admin',
      appName: 'sandy-app',
    };

    console.log('🔗 Attempting to connect to MongoDB...');

    cached.promise = connectWithRetry(MONGODB_URI, opts)
      .then((mongooseInstance) => {
        // Set up connection event handlers
        mongooseInstance.connection.on('error', (err) => {
          console.error('❌ MongoDB connection error:', err);
          // Clear cache on error to allow reconnection
          if (cached.conn && cached.conn.readyState !== 1) {
            cached.conn = null;
            cached.promise = null;
          }
        });

        mongooseInstance.connection.on('disconnected', () => {
          console.log('⚠️ MongoDB disconnected');
          cached.conn = null;
          cached.promise = null;
        });

        mongooseInstance.connection.on('reconnected', () => {
          console.log('🔁 MongoDB reconnected');
        });

        return mongooseInstance;
      })
      .catch((error) => {
        console.error('❌ MongoDB connection failed after retries:', error);
        cached.promise = null;
        cached.conn = null;
        throw error;
      });
  }

  try {
    const mongooseInstance = await cached.promise;
    cached.conn = mongooseInstance.connection;

    if (cached.conn.readyState !== 1) {
      console.warn('⚠️ MongoDB connection state:', cached.conn.readyState);
      // Wait a bit for the connection to stabilize
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  } catch (e) {
    cached.promise = null;
    cached.conn = null;
    console.error('💥 MongoDB connection error:', e);
    throw new Error(
      `Failed to connect to MongoDB: ${e instanceof Error ? e.message : "Unknown error"}`,
    );
  }

  return cached.conn as Connection;
}

// Re-export Mongoose to allow access to its types and utilities
export { mongoose }
export type { Connection, Mongoose } from "mongoose"
