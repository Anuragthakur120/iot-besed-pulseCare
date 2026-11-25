import { verifyAccessToken } from '../utils/tokens.js';
import { User, Device, HealthReading, MonitoringSession } from '@pulsecare/database';
import { closeIdleSessions } from '../controllers/session.controller.js';
import env from '../config/env.js';

let statusInterval = null;
let idleInterval = null;

/**
 * Initialize Socket.IO middleware, rooms, and background health emitter
 * @param {import('socket.io').Server} io
 */
export function initSockets(io) {
  // 1. Socket Authentication Middleware
  io.use(async (socket, next) => {
    try {
      const authHeader = socket.handshake.auth?.token || socket.handshake.headers?.authorization;
      if (!authHeader) {
        return next(new Error('Authentication error: Missing token'));
      }

      const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader;
      let decoded;
      try {
        decoded = verifyAccessToken(token);
      } catch (err) {
        return next(new Error(`Authentication error: ${err.message}`));
      }

      const user = await User.findById(decoded.id).select('_id role patientId status name');
      if (!user || user.status === 'disabled') {
        return next(new Error('Authentication error: Account disabled or not found'));
      }

      socket.user = user;
      next();
    } catch (err) {
      next(new Error(`Socket handshake failure: ${err.message}`));
    }
  });

  // 2. Connection and Room Management
  io.on('connection', (socket) => {
    const user = socket.user;
    const isDoctorOrAdmin = ['doctor', 'admin'].includes(user.role);

    console.log(`[Socket.IO] Authenticated user connected: ${user.name} (${user.role}) - Socket ${socket.id}`);

    // Clinicians automatically join 'ops' channel for device liveness
    if (isDoctorOrAdmin) {
      socket.join('ops');
    } else if (user.role === 'patient' && user.patientId) {
      // Patients join ONLY their own room
      socket.join(`patient:${user.patientId}`);
    }

    // Dynamic Room Subscription with authorization verification
    socket.on('subscribe:patient', async (targetPatientId) => {
      if (user.role === 'patient') {
        // Enforce boundary: patient cannot subscribe to another patient
        if (targetPatientId !== user.patientId) {
          socket.emit('error', { message: 'Forbidden: Cannot access another patient telemetry room' });
          return;
        }
        socket.join(`patient:${user.patientId}`);
      } else if (isDoctorOrAdmin) {
        // Doctor can join any patient room
        socket.join(`patient:${targetPatientId}`);
        console.log(`[Socket.IO] Clinician ${user.name} joined room patient:${targetPatientId}`);
      }
    });

    socket.on('unsubscribe:patient', (targetPatientId) => {
      socket.leave(`patient:${targetPatientId}`);
    });

    socket.on('disconnect', (reason) => {
      console.log(`[Socket.IO] User ${user.name} disconnected: ${reason}`);
    });
  });

  // 3. Background Liveness Job (Runs every 5 seconds)
  if (!statusInterval) {
    const staleThresholdMs = (env.STALE_THRESHOLD_SECONDS || 15) * 1000;
    const disconnectThresholdMs = staleThresholdMs * 2;

    statusInterval = setInterval(async () => {
      try {
        const devices = await Device.find({}).lean();
        const now = Date.now();

        for (const device of devices) {
          let status = 'NO_DATA';

          // Check last recorded telemetry reading
          const latestReading = await HealthReading.findOne({ 'meta.deviceId': device.deviceId })
            .sort({ ts: -1 })
            .select('ts meta')
            .lean();

          const lastHeartbeat = device.lastHeartbeatAt ? new Date(device.lastHeartbeatAt).getTime() : 0;
          const lastReadingTime = latestReading ? new Date(latestReading.ts).getTime() : 0;
          const lastActivity = Math.max(lastHeartbeat, lastReadingTime);

          if (lastActivity === 0) {
            status = 'NO_DATA';
          } else if (now - lastActivity <= staleThresholdMs) {
            status = 'LIVE';
          } else if (now - lastActivity <= disconnectThresholdMs) {
            status = 'STALE';
          } else {
            status = 'DISCONNECTED';
          }

          const payload = {
            deviceId: device.deviceId,
            status,
            lastActivityAt: lastActivity ? new Date(lastActivity).toISOString() : null,
            currentSessionId: device.currentSessionId || null
          };

          // Emit to hospital ops room
          io.to('ops').emit('device:status', payload);

          // If bound to a session, also emit to patient room
          if (latestReading?.meta?.patientId) {
            const patient = await User.findById(latestReading.meta.patientId).select('patientId').lean();
            if (patient?.patientId) {
              io.to(`patient:${patient.patientId}`).emit('device:status', payload);
            }
          }
        }
      } catch (err) {
        console.error('[Socket.IO Status Monitor Error]', err.message);
      }
    }, 5000);
  }

  // 4. Background Idle Session Auto-Close Job (Runs every 60 seconds)
  if (!idleInterval) {
    idleInterval = setInterval(async () => {
      try {
        await closeIdleSessions();
      } catch (err) {
        console.error('[Session Idle Job Error]', err.message);
      }
    }, 60000);
  }
}

export default { initSockets };
