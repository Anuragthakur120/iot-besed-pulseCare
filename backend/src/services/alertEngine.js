import { Alert, MonitoringSession, User, HealthReading } from '@pulsecare/database';
import { sendAlertNotification } from './notifier.js';

/**
 * PulseCare Intelligent Telemetry Alert Engine
 * Evaluates physiological thresholds, persistence debouncing, trend detection,
 * duplicate suppression, auto-resolution, and multi-channel notifications.
 */

// In-memory debounce state tracker: Map<`${sessionId}:${alertType}`, { firstDetectedAt: number, lastValue: any, normalSince: number|null }>
const conditionTrackers = new Map();

/**
 * Reset debounce tracker for a session (e.g. upon session completion)
 * @param {string} sessionId
 */
export function resetSessionTrackers(sessionId) {
  for (const key of conditionTrackers.keys()) {
    if (key.startsWith(`${sessionId}:`)) {
      conditionTrackers.delete(key);
    }
  }
}

/**
 * Helper to determine severity based on distance from threshold
 */
function determineSeverity(type, value, thresholds) {
  switch (type) {
    case 'HR_HIGH':
      return value > (thresholds.hrMax + 30) ? 'critical' : 'warning';
    case 'HR_LOW':
      return value < (thresholds.hrMin - 15) ? 'critical' : 'warning';
    case 'SPO2_LOW':
      return value < 90 ? 'critical' : 'warning';
    case 'TEMP_HIGH':
      return value > (thresholds.tempMax + 1.5) ? 'critical' : 'warning';
    case 'TEMP_LOW':
      return value < (thresholds.tempMin - 1.5) ? 'critical' : 'warning';
    case 'DEVICE_DISCONNECTED':
      return 'critical';
    case 'TREND_HR':
      return 'warning';
    case 'STALE_DATA':
    case 'INVALID_DATA':
    default:
      return 'warning';
  }
}

/**
 * Handle condition breach with persistence debounce
 */
async function handleBreach({ session, deviceId, patient, type, value, thresholds, nowMs, io }) {
  const trackerKey = `${session.sessionId}:${type}`;
  let tracker = conditionTrackers.get(trackerKey);

  if (!tracker) {
    tracker = { firstDetectedAt: nowMs, lastValue: value, normalSince: null };
    conditionTrackers.set(trackerKey, tracker);
  } else {
    tracker.lastValue = value;
    tracker.normalSince = null; // reset recovery timer
  }

  const persistenceMs = (thresholds.persistenceSeconds !== undefined ? thresholds.persistenceSeconds : 0) * 1000;
  const elapsedMs = nowMs - tracker.firstDetectedAt;

  // Debounce check: condition must persist for persistenceSeconds
  if (elapsedMs < persistenceMs) {
    return null; // Debouncing, do not trigger alert yet
  }

  // Check if an open alert already exists for (sessionId, type)
  let existingAlert = await Alert.findOne({
    sessionId: session.sessionId,
    type,
    resolvedAt: null
  });

  if (existingAlert) {
    // Duplicate suppression: alert is already open. Update value and timestamp without duplicating
    existingAlert.value = value;
    await existingAlert.save();

    if (io) {
      const payload = {
        ...existingAlert.toObject(),
        patient: patient ? { patientId: patient.patientId, name: patient.name } : null
      };
      io.to('ops').emit('alert:updated', payload);
      if (patient?.patientId) {
        io.to(`patient:${patient.patientId}`).emit('alert:updated', payload);
      }
    }
    return existingAlert;
  }

  // Condition persisted and no open alert exists -> Open new Alert
  const severity = determineSeverity(type, value, thresholds);

  const newAlert = await Alert.create({
    patientId: session.patientId,
    sessionId: session.sessionId,
    deviceId: deviceId || session.deviceId,
    type,
    severity,
    value,
    thresholdRef: {
      hrMin: thresholds.hrMin,
      hrMax: thresholds.hrMax,
      spo2Min: thresholds.spo2Min,
      tempMin: thresholds.tempMin,
      tempMax: thresholds.tempMax,
      persistenceSeconds: thresholds.persistenceSeconds,
      trendRule: thresholds.trendRule
    },
    triggeredAt: new Date(nowMs)
  });

  // Increment session alert count
  await MonitoringSession.updateOne(
    { sessionId: session.sessionId },
    { $inc: { alertsCount: 1 } }
  );

  // Emit Socket.IO event
  if (io) {
    const payload = {
      ...newAlert.toObject(),
      patient: patient ? { patientId: patient.patientId, name: patient.name } : null
    };
    io.to('ops').emit('alert:new', payload);
    if (patient?.patientId) {
      io.to(`patient:${patient.patientId}`).emit('alert:new', payload);
    }
  }

  // Dispatch multi-channel notification (Email / Twilio SMS)
  sendAlertNotification({ alert: newAlert, patient, session }).catch((err) => {
    console.error(`[AlertEngine] Notifier error for alert ${newAlert._id}:`, err.message);
  });

  return newAlert;
}

/**
 * Handle vital recovery to normal range (auto-resolve)
 */
async function handleRecovery({ session, patient, type, nowMs, io, recoveryWindowMs = 2000 }) {
  const trackerKey = `${session.sessionId}:${type}`;
  const tracker = conditionTrackers.get(trackerKey);

  if (tracker) {
    if (!tracker.normalSince) {
      tracker.normalSince = nowMs;
    }

    // Auto-resolve after staying normal for recovery window
    if (nowMs - tracker.normalSince >= recoveryWindowMs) {
      conditionTrackers.delete(trackerKey);

      const openAlert = await Alert.findOne({
        sessionId: session.sessionId,
        type,
        resolvedAt: null
      });

      if (openAlert) {
        openAlert.resolvedAt = new Date(nowMs);
        await openAlert.save();

        if (io) {
          const payload = {
            ...openAlert.toObject(),
            patient: patient ? { patientId: patient.patientId, name: patient.name } : null
          };
          io.to('ops').emit('alert:resolved', payload);
          io.to('ops').emit('alert:updated', payload);
          if (patient?.patientId) {
            io.to(`patient:${patient.patientId}`).emit('alert:resolved', payload);
            io.to(`patient:${patient.patientId}`).emit('alert:updated', payload);
          }
        }

        return openAlert;
      }
    }
  }

  return null;
}

/**
 * Evaluate Heart Rate Trend rule:
 * Trigger alert if HR changes more than percentChange% within windowMinutes
 */
async function evaluateHrTrend({ session, deviceId, patient, currentHr, sampleTime, thresholds, nowMs, io }) {
  if (!currentHr || !thresholds.trendRule) return null;

  const { windowMinutes = 15, percentChange = 20 } = thresholds.trendRule;
  const windowStart = new Date(sampleTime.getTime() - windowMinutes * 60 * 1000);

  // Retrieve the oldest valid reading in the trend window
  const oldestReading = await HealthReading.findOne({
    'meta.sessionId': session.sessionId,
    ts: { $gte: windowStart, $lte: sampleTime },
    heartRate: { $ne: null, $gt: 0 },
    'valid.hr': true
  }).sort({ ts: 1 });

  if (oldestReading && oldestReading.heartRate) {
    const baselineHr = oldestReading.heartRate;
    const diff = Math.abs(currentHr - baselineHr);
    const changePct = (diff / baselineHr) * 100;

    if (changePct >= percentChange) {
      return await handleBreach({
        session,
        deviceId,
        patient,
        type: 'TREND_HR',
        value: {
          currentHr,
          baselineHr,
          changePercent: Math.round(changePct * 10) / 10,
          windowMinutes
        },
        thresholds: { ...thresholds, persistenceSeconds: 0 }, // immediate trigger for trend
        nowMs,
        io
      });
    } else {
      await handleRecovery({ session, patient, type: 'TREND_HR', nowMs, io, recoveryWindowMs: 0 });
    }
  }

  return null;
}

/**
 * Main evaluation entry point called per telemetry reading
 * @param {Object} params
 * @param {Object} params.session - MonitoringSession
 * @param {Object} params.reading - Sanitized HealthReading or raw object
 * @param {Object} [params.patient] - Patient User object
 * @param {Object} [params.io] - Socket.IO instance
 * @returns {Promise<{ createdAlerts: Array, resolvedAlerts: Array }>}
 */
export async function processReadingAlerts({ session, reading, patient, io }) {
  const thresholds = session.thresholdSnapshot || {
    hrMin: 50,
    hrMax: 120,
    spo2Min: 92,
    tempMin: 35.5,
    tempMax: 38.0,
    persistenceSeconds: 5,
    trendRule: { windowMinutes: 15, percentChange: 20 }
  };

  const deviceId = reading.meta?.deviceId || reading.deviceId || session.deviceId;
  const nowMs = reading.ts ? new Date(reading.ts).getTime() : Date.now();
  const sampleTime = reading.ts ? new Date(reading.ts) : new Date(nowMs);

  const hr = reading.heartRate !== undefined ? reading.heartRate : reading.hr;
  const spo2 = reading.spo2;
  const temp = reading.temperatureC !== undefined ? reading.temperatureC : reading.tempC;
  const fingerDetected = reading.fingerDetected !== undefined ? Boolean(reading.fingerDetected) : true;
  const signalQuality = Number(reading.signalQuality) || 0;

  const createdAlerts = [];
  const resolvedAlerts = [];

  // Patient object fallback
  let resolvedPatient = patient;
  if (!resolvedPatient && session.patientId) {
    resolvedPatient = await User.findById(session.patientId).select('patientId name email emergencyContact').lean();
  }

  // 1. INVALID_DATA Check (finger off or low signal quality < 25)
  if (!fingerDetected || (signalQuality > 0 && signalQuality < 25)) {
    const invAlert = await handleBreach({
      session,
      deviceId,
      patient: resolvedPatient,
      type: 'INVALID_DATA',
      value: { fingerDetected, signalQuality },
      thresholds,
      nowMs,
      io
    });
    if (invAlert) createdAlerts.push(invAlert);
  } else {
    const resAlert = await handleRecovery({ session, patient: resolvedPatient, type: 'INVALID_DATA', nowMs, io });
    if (resAlert) resolvedAlerts.push(resAlert);
  }

  // 2. Heart Rate High / Low
  if (hr && hr > 0) {
    if (hr > thresholds.hrMax) {
      const a = await handleBreach({
        session,
        deviceId,
        patient: resolvedPatient,
        type: 'HR_HIGH',
        value: hr,
        thresholds,
        nowMs,
        io
      });
      if (a) createdAlerts.push(a);
      // Ensure HR_LOW is recovered
      const r = await handleRecovery({ session, patient: resolvedPatient, type: 'HR_LOW', nowMs, io, recoveryWindowMs: 0 });
      if (r) resolvedAlerts.push(r);
    } else if (hr < thresholds.hrMin) {
      const a = await handleBreach({
        session,
        deviceId,
        patient: resolvedPatient,
        type: 'HR_LOW',
        value: hr,
        thresholds,
        nowMs,
        io
      });
      if (a) createdAlerts.push(a);
      // Ensure HR_HIGH is recovered
      const r = await handleRecovery({ session, patient: resolvedPatient, type: 'HR_HIGH', nowMs, io, recoveryWindowMs: 0 });
      if (r) resolvedAlerts.push(r);
    } else {
      // HR is within normal safe bounds
      const r1 = await handleRecovery({ session, patient: resolvedPatient, type: 'HR_HIGH', nowMs, io });
      const r2 = await handleRecovery({ session, patient: resolvedPatient, type: 'HR_LOW', nowMs, io });
      if (r1) resolvedAlerts.push(r1);
      if (r2) resolvedAlerts.push(r2);
    }

    // 3. Evaluate Trend Rule on HR
    const trendAlert = await evaluateHrTrend({
      session,
      deviceId,
      patient: resolvedPatient,
      currentHr: hr,
      sampleTime,
      thresholds,
      nowMs,
      io
    });
    if (trendAlert) createdAlerts.push(trendAlert);
  }

  // 4. SpO2 Low
  if (spo2 && spo2 > 0) {
    if (spo2 < thresholds.spo2Min) {
      const a = await handleBreach({
        session,
        deviceId,
        patient: resolvedPatient,
        type: 'SPO2_LOW',
        value: spo2,
        thresholds,
        nowMs,
        io
      });
      if (a) createdAlerts.push(a);
    } else {
      const r = await handleRecovery({ session, patient: resolvedPatient, type: 'SPO2_LOW', nowMs, io });
      if (r) resolvedAlerts.push(r);
    }
  }

  // 5. Temperature High / Low
  if (temp && temp > 0) {
    if (temp > thresholds.tempMax) {
      const a = await handleBreach({
        session,
        deviceId,
        patient: resolvedPatient,
        type: 'TEMP_HIGH',
        value: temp,
        thresholds,
        nowMs,
        io
      });
      if (a) createdAlerts.push(a);
      const r = await handleRecovery({ session, patient: resolvedPatient, type: 'TEMP_LOW', nowMs, io, recoveryWindowMs: 0 });
      if (r) resolvedAlerts.push(r);
    } else if (temp < thresholds.tempMin) {
      const a = await handleBreach({
        session,
        deviceId,
        patient: resolvedPatient,
        type: 'TEMP_LOW',
        value: temp,
        thresholds,
        nowMs,
        io
      });
      if (a) createdAlerts.push(a);
      const r = await handleRecovery({ session, patient: resolvedPatient, type: 'TEMP_HIGH', nowMs, io, recoveryWindowMs: 0 });
      if (r) resolvedAlerts.push(r);
    } else {
      const r1 = await handleRecovery({ session, patient: resolvedPatient, type: 'TEMP_HIGH', nowMs, io });
      const r2 = await handleRecovery({ session, patient: resolvedPatient, type: 'TEMP_LOW', nowMs, io });
      if (r1) resolvedAlerts.push(r1);
      if (r2) resolvedAlerts.push(r2);
    }
  }

  return { createdAlerts, resolvedAlerts };
}

/**
 * Check for Device Disconnection or Stale Telemetry
 */
export async function checkDeviceLiveness({ session, device, io, staleThresholdSec = 30 }) {
  if (!session || session.status !== 'active') return null;

  const nowMs = Date.now();
  const lastActivity = device.lastHeartbeatAt ? new Date(device.lastHeartbeatAt).getTime() : 0;
  const disconnected = (nowMs - lastActivity) > (staleThresholdSec * 1000);

  const thresholds = session.thresholdSnapshot || { persistenceSeconds: 0 };
  const patient = await User.findById(session.patientId).select('patientId name email emergencyContact').lean();

  if (disconnected) {
    return await handleBreach({
      session,
      deviceId: device.deviceId,
      patient,
      type: 'DEVICE_DISCONNECTED',
      value: { lastSeenAt: device.lastHeartbeatAt, offlineSeconds: Math.round((nowMs - lastActivity) / 1000) },
      thresholds: { ...thresholds, persistenceSeconds: 0 },
      nowMs,
      io
    });
  } else {
    return await handleRecovery({
      session,
      patient,
      type: 'DEVICE_DISCONNECTED',
      nowMs,
      io,
      recoveryWindowMs: 0
    });
  }
}

export default {
  processReadingAlerts,
  checkDeviceLiveness,
  resetSessionTrackers
};
