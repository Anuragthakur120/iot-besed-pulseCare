import mongoose from 'mongoose';

let isConnected = false;
let isShuttingDown = false;

const MAX_RETRIES = 5;
const RETRY_INTERVAL_MS = 3000;

/**
 * Connect to MongoDB with automatic retry mechanism
 * @param {string} uri - MongoDB connection string
 * @param {import('mongoose').ConnectOptions} [options]
 * @returns {Promise<typeof mongoose>}
 */
export async function connectDB(uri, options = {}) {
  if (!uri) {
    throw new Error('[Database] MONGODB_URI is required to establish a connection.');
  }

  // If already connected, return existing mongoose instance
  if (mongoose.connection.readyState === 1) {
    isConnected = true;
    return mongoose;
  }

  const defaultOptions = {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    maxPoolSize: 20,
    minPoolSize: 2,
    autoIndex: process.env.NODE_ENV !== 'production',
    ...options
  };

  let attempt = 0;

  while (attempt < MAX_RETRIES) {
    try {
      attempt++;
      console.log(`[Database] Attempting connection to MongoDB (Attempt ${attempt}/${MAX_RETRIES})...`);
      
      await mongoose.connect(uri, defaultOptions);
      isConnected = true;
      console.log(`[Database] Successfully connected to MongoDB at ${mongoose.connection.host}/${mongoose.connection.name}`);
      return mongoose;
    } catch (err) {
      console.error(`[Database] Connection attempt ${attempt} failed: ${err.message}`);
      
      if (attempt >= MAX_RETRIES) {
        console.error('[Database] Maximum retry attempts reached. Could not connect to MongoDB.');
        throw err;
      }

      console.log(`[Database] Retrying in ${RETRY_INTERVAL_MS / 1000}s...`);
      await new Promise((resolve) => setTimeout(resolve, RETRY_INTERVAL_MS));
    }
  }

  return mongoose;
}

/**
 * Disconnect from MongoDB gracefully
 */
export async function disconnectDB() {
  if (mongoose.connection.readyState !== 0) {
    console.log('[Database] Closing MongoDB connection...');
    await mongoose.connection.close();
    isConnected = false;
    console.log('[Database] MongoDB connection closed.');
  }
}

/**
 * Returns true if mongoose is currently connected
 * @returns {boolean}
 */
export function isDatabaseConnected() {
  return mongoose.connection.readyState === 1;
}

/**
 * Returns human-readable state of the database connection
 * @returns {'connected' | 'connecting' | 'disconnecting' | 'disconnected'}
 */
export function getConnectionStatus() {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };
  return states[mongoose.connection.readyState] || 'disconnected';
}

// Global Connection Event Listeners
mongoose.connection.on('connected', () => {
  isConnected = true;
  console.log('[Database:Event] Mongoose connected to DB');
});

mongoose.connection.on('error', (err) => {
  console.error('[Database:Event] Mongoose connection error:', err.message);
});

mongoose.connection.on('disconnected', () => {
  isConnected = false;
  if (!isShuttingDown) {
    console.warn('[Database:Event] Mongoose disconnected from DB. Awaiting reconnection...');
  }
});

// Graceful process termination handlers
const handleGracefulShutdown = async (signal) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`[Database] Received ${signal}. Closing Mongoose connection...`);
  try {
    await disconnectDB();
  } catch (err) {
    console.error('[Database] Error closing connection during shutdown:', err);
  }
};

process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));
process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));

export default {
  connectDB,
  disconnectDB,
  isDatabaseConnected,
  getConnectionStatus
};
