import { Router } from 'express';
import * as deviceController from '../controllers/device.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { authenticateDevice } from '../middleware/deviceAuth.js';

const router = Router();

// ==========================================
// 1. Clinician / Admin Device Management
// ==========================================

// List all devices
router.get('/', authenticate, requireRole('doctor', 'admin'), deviceController.getDevices);

// Admin registers new device -> returns one-time pairing code
router.post('/', authenticate, requireRole('admin', 'doctor'), deviceController.createDevice);

// Admin revokes device (instantly blocks it)
router.post('/:deviceId/revoke', authenticate, requireRole('admin', 'doctor'), deviceController.revokeDevice);

// Admin rotates device key -> returns new pairing code
router.post('/:deviceId/rotate-key', authenticate, requireRole('admin', 'doctor'), deviceController.rotateDeviceKey);

// ==========================================
// 2. Hardware ESP32 Device Endpoints
// ==========================================

// One-time pairing endpoint
router.post('/pair', deviceController.pairDevice);

// Periodic hardware heartbeat (HMAC-SHA256 authenticated)
router.post('/heartbeat', authenticateDevice, deviceController.deviceHeartbeat);

// Telemetry reading ingestion (single or batch array, HMAC-SHA256 authenticated)
router.post('/readings', authenticateDevice, deviceController.ingestReadings);
router.post('/ingest', authenticateDevice, deviceController.ingestReadings);

// Remote device configuration (sample rate, local buzzer thresholds)
router.get('/config', authenticateDevice, deviceController.getDeviceConfig);

export default router;
