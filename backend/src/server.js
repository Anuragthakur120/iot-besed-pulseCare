import http from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import app from './app.js';
import env from './config/env.js';
import { connectDB, disconnectDB } from '@pulsecare/database';

import { initSockets } from './sockets/index.js';

// 1. Create HTTP Server
const httpServer = http.createServer(app);

// 2. Bootstrap Socket.IO Server
const allowedOrigins = env.CLIENT_ORIGIN.split(',').map((o) => o.trim());

const io = new SocketIOServer(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        return callback(null, true);
      }
      return callback(new Error(`Socket origin not allowed: ${origin}`));
    },
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingTimeout: 20000,
  pingInterval: 25000
});

// Store io instance in Express app for controller access
app.set('io', io);

// Initialize real-time telemetry handlers & background tasks
initSockets(io);

// 3. Start Database Connection & Listen on HTTP Port
async function startServer() {
  try {
    // Connect to MongoDB
    await connectDB(env.MONGODB_URI);

    // Initialize background cron jobs (appointment reminders & data retention)
    const { initCronJobs } = await import('./jobs/scheduler.js');
    initCronJobs();

    // Listen on configured port
    httpServer.listen(env.PORT, () => {
      console.log('\n======================================================');
      console.log(` PulseCare Backend Server Started Successfully`);
      console.log(` Port:        http://localhost:${env.PORT}`);
      console.log(` Health:      http://localhost:${env.PORT}/api/health`);
      console.log(` Environment: ${env.NODE_ENV}`);
      console.log('======================================================\n');
    });
  } catch (error) {
    console.error('[Server Startup Failure]', error);
    process.exit(1);
  }
}

// 4. Graceful Shutdown
const handleShutdown = async (signal) => {
  console.log(`\n[Server] Received ${signal}. Initiating graceful shutdown...`);

  // Close HTTP and Socket connections
  httpServer.close(async () => {
    console.log('[Server] HTTP server closed.');

    try {
      await io.close();
      console.log('[Server] Socket.IO closed.');
      await disconnectDB();
      console.log('[Server] All services shut down cleanly. Exiting.');
      process.exit(0);
    } catch (err) {
      console.error('[Server] Error during teardown:', err);
      process.exit(1);
    }
  });

  // Force close after timeout if graceful shutdown hangs
  setTimeout(() => {
    console.error('[Server] Shutdown timed out. Forcing termination.');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

// Start server
startServer();

export { httpServer, io };
