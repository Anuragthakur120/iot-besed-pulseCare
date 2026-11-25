import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Device, MonitoringSession, HealthReading, Alert, User, ThresholdProfile } from '@pulsecare/database';
import { encryptSecret, decryptSecret, hashSecret } from '../utils/crypto.js';
import { logAudit } from '../middleware/audit.js';
import { processReadingAlerts } from '../services/alertEngine.js';

/**
 * GET /api/devices
 * List registered devices for clinicians & admin UI
 */
export async function getDevices(req, res, next) {
  try {
    const devices = await Device.find({})
      .select('deviceId label status currentSessionId lastHeartbeatAt firmwareVersion ipLast rssi uptime freeHeap createdAt')
      .sort({ deviceId: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: { devices },
      error: null
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/devices
 * Admin creates a new device: returns deviceId + one-time pairing code
 */
export async function createDevice(req, res, next) {
  try {
    const { label } = req.body;

    // Generate next sequential or unique PCD-XXXX ID
    let deviceId = req.body.deviceId ? req.body.deviceId.toUpperCase().trim() : null;

    if (!deviceId) {
      const count = await Device.countDocuments({});
      const nextNum = (count + 1).toString().padStart(4, '0');
      deviceId = `PCD-${nextNum}`;

      // Check collision
      const existing = await Device.findOne({ deviceId });
      if (existing) {
        deviceId = `PCD-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
      }
    }

    // Generate random 6-character alphanumeric pairing code (e.g. 849201)
    const rawPairingCode = Math.floor(100000 + Math.random() * 900000).toString();
    const pairingCodeHash = hashSecret(rawPairingCode);
    const pairingExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    const newDevice = await Device.create({
      deviceId,
      label: label || 'Bedside Node',
      status: 'pending',
      pairingCodeHash,
      pairingExpiresAt,
      createdBy: req.user?._id || null
    });

    if (req.user) {
      await logAudit({
        req,
        action: 'DEVICE_CREATE',
        targetType: 'Device',
        targetId: newDevice._id,
        meta: { deviceId },
        actor: req.user
      });
    }

    return res.status(201).json({
      success: true,
      data: {
        deviceId: newDevice.deviceId,
        label: newDevice.label,
        pairingCode: rawPairingCode,
        expiresAt: pairingExpiresAt.toISOString(),
        message: 'Device created. The pairing code is shown ONCE and expires in 15 minutes.'
      },
      error: null
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/device/pair
 * Device calls with pairing code to receive long random deviceKey
 */
export async function pairDevice(req, res, next) {
  try {
    const { deviceId: rawDeviceId, pairingCode } = req.body;

    if (!rawDeviceId || !pairingCode) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Both deviceId and pairingCode are required'
      });
    }

    const deviceId = String(rawDeviceId).trim().toUpperCase();
    const device = await Device.findOne({ deviceId });

    if (!device) {
      return res.status(404).json({
        success: false,
        data: null,
        error: `Device ${deviceId} not found`
      });
    }

    if (device.status === 'revoked') {
      return res.status(403).json({
        success: false,
        data: null,
        error: `Device ${deviceId} authorization has been revoked`
      });
    }

    if (!device.pairingCodeHash || !device.pairingExpiresAt) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Device has no active pairing session. Request a new pairing code from admin.'
      });
    }

    if (new Date() > new Date(device.pairingExpiresAt)) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Pairing code has expired. Request a new pairing code.'
      });
    }

    const inputHash = hashSecret(String(pairingCode).trim());
    if (inputHash !== device.pairingCodeHash) {
      return res.status(401).json({
        success: false,
        data: null,
        error: 'Invalid pairing code'
      });
    }

    // Generate 64-character hex deviceKey (32 bytes)
    const rawDeviceKey = crypto.randomBytes(32).toString('hex');

    device.encryptedKey = encryptSecret(rawDeviceKey);
    device.credentialHash = hashSecret(rawDeviceKey);
    device.status = 'active';
    device.pairingCodeHash = null;
    device.pairingExpiresAt = null;
    device.lastHeartbeatAt = new Date();
    device.ipLast = req.ip || req.headers['x-forwarded-for'] || null;
    await device.save();

    console.log(`[Device Security] Device ${deviceId} successfully paired.`);

    const io = req.app.get('io');
    if (io) {
      io.to('ops').emit('device:status', {
        deviceId: device.deviceId,
        status: 'LIVE',
        lastActivityAt: device.lastHeartbeatAt.toISOString(),
        currentSessionId: null
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        deviceId: device.deviceId,
        deviceKey: rawDeviceKey,
        message: 'Device paired successfully. Store deviceKey in NVS/EEPROM. It will never be shown again.'
      },
      error: null
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/device/heartbeat
 * Hardware heartbeat authenticated with HMAC-SHA256
 */
export async function deviceHeartbeat(req, res, next) {
  try {
    const device = req.device;
    const { firmwareVersion, rssi, uptime, freeHeap } = req.body || {};

    device.lastHeartbeatAt = new Date();
    device.ipLast = req.ip || req.headers['x-forwarded-for'] || null;
    if (firmwareVersion) device.firmwareVersion = String(firmwareVersion);
    if (rssi !== undefined) device.rssi = Number(rssi);
    if (uptime !== undefined) device.uptime = Number(uptime);
    if (freeHeap !== undefined) device.freeHeap = Number(freeHeap);
    await device.save();

    const io = req.app.get('io');
    if (io) {
      io.to('ops').emit('device:status', {
        deviceId: device.deviceId,
        status: 'LIVE',
        lastActivityAt: device.lastHeartbeatAt.toISOString(),
        currentSessionId: device.currentSessionId || null,
        rssi: device.rssi,
        uptime: device.uptime,
        freeHeap: device.freeHeap
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        deviceId: device.deviceId,
        status: 'LIVE',
        currentSessionId: device.currentSessionId || null,
        hasActiveSession: Boolean(device.currentSessionId)
      },
      error: null
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Helper to validate vital ranges
 * Range rules: HR 30-220, SpO2 70-100, temp 25-45
 */
function sanitizeAndValidateReading(r) {
  const hr = r.hr !== undefined ? r.hr : r.heartRate;
  const spo2 = r.spo2 !== undefined ? r.spo2 : null;
  const temp = r.tempC !== undefined ? r.tempC : (r.temperatureC !== undefined ? r.temperatureC : null);
  const fingerDetected = r.fingerDetected !== undefined ? Boolean(r.fingerDetected) : true;
  const signalQuality = Number(r.signalQuality) || 0;

  let validHr = false;
  let finalHr = null;
  if (fingerDetected && hr !== null && hr !== undefined && hr > 0) {
    if (hr >= 30 && hr <= 220) {
      finalHr = Math.round(Number(hr));
      validHr = true;
    }
  }

  let validSpo2 = false;
  let finalSpo2 = null;
  if (fingerDetected && spo2 !== null && spo2 !== undefined && spo2 > 0) {
    if (spo2 >= 70 && spo2 <= 100) {
      finalSpo2 = Math.round(Number(spo2));
      validSpo2 = true;
    }
  }

  let validTemp = false;
  let finalTemp = null;
  if (temp !== null && temp !== undefined && temp > 0) {
    if (temp >= 25 && temp <= 45) {
      finalTemp = Math.round(Number(temp) * 10) / 10;
      validTemp = true;
    }
  }

  return {
    finalHr,
    finalSpo2,
    finalTemp,
    fingerDetected,
    signalQuality: Math.max(0, Math.min(100, signalQuality)),
    validFlags: { hr: validHr, spo2: validSpo2, temp: validTemp }
  };
}

/**
 * POST /api/device/readings
 * Ingest single telemetry reading or BATCH offline buffer array
 */
export async function ingestReadings(req, res, next) {
  try {
    const device = req.device;
    const rawData = req.body;

    // Must have an active monitoring session assigned by clinician
    let activeSession = null;
    if (device.currentSessionId) {
      activeSession = await MonitoringSession.findOne({
        sessionId: device.currentSessionId,
        status: 'active'
      });
    }

    if (!activeSession) {
      activeSession = await MonitoringSession.findOne({
        deviceId: device.deviceId,
        status: 'active'
      });
      if (activeSession) {
        device.currentSessionId = activeSession.sessionId;
        await device.save();
      }
    }

    if (!activeSession) {
      return res.status(409).json({
        success: false,
        data: null,
        error: 'no_active_session',
        message: `Device ${device.deviceId} has no active clinical monitoring session assigned by a clinician.`
      });
    }

    const readingsList = Array.isArray(rawData) ? rawData : (rawData?.readings ? rawData.readings : [rawData]);
    const nowMs = Date.now();
    const maxFutureMs = nowMs + 5 * 60 * 1000; // 5 minutes in future

    const processedReadings = [];
    let alertsCreatedCount = 0;

    const sessionThresholds = activeSession.thresholdSnapshot || {
      hrMin: 50,
      hrMax: 120,
      spo2Min: 92,
      tempMin: 35.5,
      tempMax: 38.0
    };

    const io = req.app.get('io');
    const patientUser = await User.findById(activeSession.patientId).select('patientId name').lean();

    for (const item of readingsList) {
      const seq = Number(item.seq) || 0;

      // De-duplication by (deviceId, seq)
      const existing = await HealthReading.findOne({
        'meta.deviceId': device.deviceId,
        seq
      });
      if (existing) {
        continue; // Skip duplicate packet
      }

      // Timestamp processing: ignore future > 5 min, use server receive time if missing
      let sampleTime = new Date();
      if (item.ts) {
        const itemTs = typeof item.ts === 'number' ? item.ts : new Date(item.ts).getTime();
        if (itemTs <= maxFutureMs) {
          sampleTime = new Date(itemTs);
        }
      }

      const { finalHr, finalSpo2, finalTemp, fingerDetected, signalQuality, validFlags } =
        sanitizeAndValidateReading(item);

      // Create time-series reading
      const reading = await HealthReading.create({
        ts: sampleTime,
        meta: {
          patientId: activeSession.patientId,
          sessionId: activeSession.sessionId,
          deviceId: device.deviceId
        },
        heartRate: finalHr,
        spo2: finalSpo2,
        temperatureC: finalTemp,
        fingerDetected,
        signalQuality,
        valid: validFlags,
        seq,
        source: item.isDemo ? 'seed-demo' : 'device',
        isDemo: Boolean(item.isDemo)
      });

      processedReadings.push(reading);

      // Process telemetry reading through Intelligent Alert Engine (persistence, debounce, trend, auto-resolve)
      const { createdAlerts } = await processReadingAlerts({
        session: activeSession,
        reading,
        patient: patientUser,
        io
      });
      alertsCreatedCount += (createdAlerts ? createdAlerts.length : 0);

      // Emit reading to Socket.IO
      if (io) {
        const readingPayload = {
          _id: reading._id,
          ts: reading.ts,
          sessionId: activeSession.sessionId,
          deviceId: device.deviceId,
          patientId: patientUser?.patientId,
          heartRate: reading.heartRate,
          spo2: reading.spo2,
          temperatureC: reading.temperatureC,
          fingerDetected: reading.fingerDetected,
          signalQuality: reading.signalQuality,
          valid: reading.valid,
          seq: reading.seq
        };

        if (patientUser?.patientId) {
          io.to(`patient:${patientUser.patientId}`).emit('reading:new', readingPayload);
        }
        io.to('ops').emit('reading:new', readingPayload);
      }
    }

    // Update Device lastHeartbeatAt
    device.lastHeartbeatAt = new Date();
    await device.save();

    if (io) {
      io.to('ops').emit('device:status', {
        deviceId: device.deviceId,
        status: 'LIVE',
        lastActivityAt: device.lastHeartbeatAt.toISOString(),
        currentSessionId: activeSession.sessionId
      });
    }

    return res.status(201).json({
      success: true,
      data: {
        processed: processedReadings.length,
        sessionId: activeSession.sessionId,
        alertsCreated: alertsCreatedCount,
        alertsTriggered: alertsCreatedCount
      },
      error: null
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/device/config
 * Remote configuration for ESP32 hardware node
 */
export async function getDeviceConfig(req, res, next) {
  try {
    const device = req.device;

    let thresholds = {
      hrMin: 50,
      hrMax: 120,
      spo2Min: 92,
      tempMin: 35.5,
      tempMax: 38.0
    };

    if (device.currentSessionId) {
      const session = await MonitoringSession.findOne({ sessionId: device.currentSessionId });
      if (session?.thresholdSnapshot) {
        thresholds = session.thresholdSnapshot;
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        deviceId: device.deviceId,
        sampleIntervalMs: 1000,
        heartbeatIntervalMs: 10000,
        bufferOffline: true,
        maxOfflineSamples: 120,
        thresholds: {
          hrMin: thresholds.hrMin,
          hrMax: thresholds.hrMax,
          spo2Min: thresholds.spo2Min,
          tempMin: thresholds.tempMin,
          tempMax: thresholds.tempMax
        }
      },
      error: null
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/devices/:deviceId/revoke
 * Admin revokes a hardware device (instantly blocks it)
 */
export async function revokeDevice(req, res, next) {
  try {
    const { deviceId: rawId } = req.params;
    const deviceId = rawId.toUpperCase().trim();

    const device = await Device.findOne({ deviceId });
    if (!device) {
      return res.status(404).json({
        success: false,
        data: null,
        error: `Device ${deviceId} not found`
      });
    }

    device.status = 'revoked';
    const oldSessionId = device.currentSessionId;
    device.currentSessionId = null;
    await device.save();

    // If active session, abort it
    if (oldSessionId) {
      await MonitoringSession.updateOne(
        { sessionId: oldSessionId, status: 'active' },
        { status: 'aborted', endedAt: new Date(), notes: 'Aborted: Device revoked by admin.' }
      );
    }

    const io = req.app.get('io');
    if (io) {
      io.to('ops').emit('device:status', {
        deviceId: device.deviceId,
        status: 'DISCONNECTED',
        lastActivityAt: new Date().toISOString(),
        currentSessionId: null
      });
    }

    await logAudit({
      req,
      action: 'DEVICE_REVOKE',
      targetType: 'Device',
      targetId: device._id,
      meta: { deviceId },
      actor: req.user
    });

    return res.status(200).json({
      success: true,
      data: {
        deviceId: device.deviceId,
        status: 'revoked',
        message: `Device ${deviceId} has been revoked and blocked.`
      },
      error: null
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/devices/:deviceId/rotate-key
 * Generates a new one-time pairing code for an existing device
 */
export async function rotateDeviceKey(req, res, next) {
  try {
    const { deviceId: rawId } = req.params;
    const deviceId = rawId.toUpperCase().trim();

    const device = await Device.findOne({ deviceId });
    if (!device) {
      return res.status(404).json({
        success: false,
        data: null,
        error: `Device ${deviceId} not found`
      });
    }

    const rawPairingCode = Math.floor(100000 + Math.random() * 900000).toString();
    device.pairingCodeHash = hashSecret(rawPairingCode);
    device.pairingExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins
    device.status = 'pending';
    device.encryptedKey = null;
    device.credentialHash = null;
    await device.save();

    await logAudit({
      req,
      action: 'DEVICE_KEY_ROTATE',
      targetType: 'Device',
      targetId: device._id,
      meta: { deviceId },
      actor: req.user
    });

    return res.status(200).json({
      success: true,
      data: {
        deviceId: device.deviceId,
        pairingCode: rawPairingCode,
        expiresAt: device.pairingExpiresAt.toISOString(),
        message: 'New pairing code generated. Re-pair the device within 15 minutes.'
      },
      error: null
    });
  } catch (error) {
    next(error);
  }
}

export default {
  getDevices,
  createDevice,
  pairDevice,
  deviceHeartbeat,
  ingestReadings,
  getDeviceConfig,
  revokeDevice,
  rotateDeviceKey
};
