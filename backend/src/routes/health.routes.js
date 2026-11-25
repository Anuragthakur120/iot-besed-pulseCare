import { Router } from 'express';
import { isDatabaseConnected, getConnectionStatus } from '@pulsecare/database';

const router = Router();

/**
 * @route   GET /api/health
 * @desc    System health check returning status, uptime, and database connection state
 * @access  Public
 */
router.get('/', (_req, res) => {
  const connected = isDatabaseConnected();
  const dbState = getConnectionStatus();

  res.status(200).json({
    status: 'ok',
    db: connected ? 'connected' : dbState,
    uptime: Math.round(process.uptime() * 100) / 100,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

/**
 * @route   GET /api/health/ready (or /api/ready)
 * @desc    Kubernetes / Container Readiness probe: returns 200 if DB is ready, 503 if degraded
 */
router.get('/ready', (_req, res) => {
  const connected = isDatabaseConnected();
  if (connected) {
    return res.status(200).json({ status: 'ready', db: 'connected' });
  }
  return res.status(503).json({ status: 'unready', db: 'disconnected' });
});

export default router;
