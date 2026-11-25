import mongoose from 'mongoose';
import {
  MonitoringSession,
  Device,
  User,
  ThresholdProfile,
  HealthReading,
  Alert
} from '@pulsecare/database';
import { logAudit } from '../middleware/audit.js';

/**
 * POST /api/sessions
 * Doctor starts a new monitoring session: patientId + deviceId
 */
export async function startSession(req, res, next) {
  try {
    const { patientId: rawPatientId, deviceId, notes } = req.body;

    const isObjectId = mongoose.Types.ObjectId.isValid(rawPatientId);
    const patientQuery = isObjectId
      ? { $or: [{ patientId: rawPatientId }, { _id: rawPatientId }], role: 'patient' }
      : { patientId: rawPatientId, role: 'patient' };

    const patient = await User.findOne(patientQuery);

    if (!patient) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'Target patient not found'
      });
    }

    const device = await Device.findOne({ deviceId: deviceId.toUpperCase() });
    if (!device) {
      return res.status(404).json({
        success: false,
        data: null,
        error: `Device ${deviceId} not found`
      });
    }

    if (device.status !== 'active') {
      return res.status(400).json({
        success: false,
        data: null,
        error: `Device ${deviceId} is currently ${device.status}. Only active devices can be paired.`
      });
    }

    // Verify device is not currently assigned to another active session
    const existingActiveDeviceSession = await MonitoringSession.findOne({
      deviceId: device.deviceId,
      status: 'active'
    });

    if (existingActiveDeviceSession) {
      return res.status(409).json({
        success: false,
        data: null,
        error: `Device ${device.deviceId} is already in use in active session ${existingActiveDeviceSession.sessionId}`
      });
    }

    // Verify patient is not already in an active session
    const existingActivePatientSession = await MonitoringSession.findOne({
      patientId: patient._id,
      status: 'active'
    });

    if (existingActivePatientSession) {
      return res.status(409).json({
        success: false,
        data: null,
        error: `Patient already has an active monitoring session (${existingActivePatientSession.sessionId})`
      });
    }

    // Snapshot patient's ThresholdProfile or default profile
    let profile = await ThresholdProfile.findOne({
      scope: 'patient',
      patientId: patient._id
    });

    if (!profile) {
      profile = await ThresholdProfile.findOne({ scope: 'default' });
    }

    const thresholdSnapshot = {
      hrMin: profile?.hrMin ?? 50,
      hrMax: profile?.hrMax ?? 120,
      spo2Min: profile?.spo2Min ?? 92,
      tempMin: profile?.tempMin ?? 35.5,
      tempMax: profile?.tempMax ?? 38.0,
      persistenceSeconds: profile ? profile.persistenceSeconds : 0,
      trendRule: profile?.trendRule ?? { windowMinutes: 15, percentChange: 20 }
    };

    const session = await MonitoringSession.create({
      patientId: patient._id,
      deviceId: device.deviceId,
      startedBy: req.user._id,
      startedAt: new Date(),
      status: 'active',
      notes: notes || '',
      thresholdSnapshot
    });

    device.currentSessionId = session.sessionId;
    await device.save();

    // Broadcast Socket.IO event
    const io = req.app.get('io');
    if (io) {
      io.to(`patient:${patient.patientId}`).emit('session:started', session);
      io.to('ops').emit('session:started', session);
    }

    await logAudit({
      req,
      action: 'SESSION_START',
      targetType: 'MonitoringSession',
      targetId: session._id,
      meta: { sessionId: session.sessionId, patientId: patient.patientId, deviceId: device.deviceId },
      actor: req.user
    });

    return res.status(201).json({
      success: true,
      data: { session },
      error: null
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/sessions/:sessionId
 */
export async function getSessionById(req, res, next) {
  try {
    const { sessionId } = req.params;

    const session = await MonitoringSession.findOne({ sessionId })
      .populate('patientId', 'name patientId email dob phone')
      .populate('startedBy', 'name role')
      .lean();

    if (!session) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'Monitoring session not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: { session },
      error: null
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/sessions/:sessionId/stop
 */
export async function stopSession(req, res, next) {
  try {
    const { sessionId } = req.params;
    const { notes } = req.body;

    const session = await MonitoringSession.findOne({ sessionId });
    if (!session) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'Monitoring session not found'
      });
    }

    if (session.status !== 'active') {
      return res.status(400).json({
        success: false,
        data: null,
        error: `Session is already ${session.status}`
      });
    }

    session.status = 'completed';
    session.endedAt = new Date();
    if (notes) {
      session.notes = session.notes ? `${session.notes}\n${notes}` : notes;
    }
    await session.save();

    // Free device
    await Device.updateOne(
      { deviceId: session.deviceId },
      { currentSessionId: null }
    );

    // Broadcast Socket.IO event
    const io = req.app.get('io');
    if (io) {
      io.to('ops').emit('session:stopped', session);
      const patient = await User.findById(session.patientId).select('patientId');
      if (patient) {
        io.to(`patient:${patient.patientId}`).emit('session:stopped', session);
      }
    }

    await logAudit({
      req,
      action: 'SESSION_STOP',
      targetType: 'MonitoringSession',
      targetId: session._id,
      meta: { sessionId: session.sessionId },
      actor: req.user
    });

    return res.status(200).json({
      success: true,
      data: { session },
      error: null
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/patients/:patientId/sessions
 */
export async function getPatientSessions(req, res, next) {
  try {
    const { patientId } = req.params;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;

    const isObjectId = mongoose.Types.ObjectId.isValid(patientId);
    const patientQuery = isObjectId
      ? { $or: [{ patientId }, { _id: patientId }], role: 'patient' }
      : { patientId, role: 'patient' };

    const patient = await User.findOne(patientQuery).select('_id');
    if (!patient) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'Patient record not found'
      });
    }

    const total = await MonitoringSession.countDocuments({ patientId: patient._id });
    const sessions = await MonitoringSession.find({ patientId: patient._id })
      .populate('startedBy', 'name role')
      .sort({ startedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return res.status(200).json({
      success: true,
      data: {
        sessions,
        pagination: {
          total,
          page,
          pages: Math.ceil(total / limit) || 1,
          limit
        }
      },
      error: null
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/patients/:patientId/readings
 * Downsamples to max 1000 points server-side for chart rendering
 */
export async function getPatientReadings(req, res, next) {
  try {
    const { patientId } = req.params;
    const { sessionId, range, from, to, limit = 1000 } = req.query;

    const isObjectId = mongoose.Types.ObjectId.isValid(patientId);
    const patientQuery = isObjectId
      ? { $or: [{ patientId }, { _id: patientId }], role: 'patient' }
      : { patientId, role: 'patient' };

    const patient = await User.findOne(patientQuery).select('_id');
    if (!patient) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'Patient record not found'
      });
    }

    const query = { 'meta.patientId': patient._id };

    if (sessionId) {
      query['meta.sessionId'] = sessionId;
    }

    const now = Date.now();
    if (range === '24h') {
      query.ts = { $gte: new Date(now - 24 * 3600 * 1000) };
    } else if (range === '7d') {
      query.ts = { $gte: new Date(now - 7 * 24 * 3600 * 1000) };
    } else if (range === '30d') {
      query.ts = { $gte: new Date(now - 30 * 24 * 3600 * 1000) };
    } else if (from || to) {
      query.ts = {};
      if (from) query.ts.$gte = new Date(from);
      if (to) query.ts.$lte = new Date(to);
    }

    const maxLimit = Math.min(parseInt(limit, 10) || 1000, 5000);
    const rawReadings = await HealthReading.find(query)
      .sort({ ts: 1 })
      .limit(maxLimit)
      .lean();

    // Downsample to max 1000 points if dataset exceeds 1000
    let downsampled = rawReadings;
    if (rawReadings.length > 1000) {
      const step = Math.ceil(rawReadings.length / 1000);
      downsampled = rawReadings.filter((_, idx) => idx % step === 0);
    }

    return res.status(200).json({
      success: true,
      data: {
        readings: downsampled,
        count: downsampled.length,
        totalRaw: rawReadings.length
      },
      error: null
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Calculation helper for vital stats
 */
function calculateVitalStats(values) {
  if (!values || values.length === 0) {
    return { min: null, max: null, avg: null, median: null, count: 0 };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const sum = sorted.reduce((acc, curr) => acc + curr, 0);
  const avg = Math.round((sum / sorted.length) * 10) / 10;

  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 !== 0 ? sorted[mid] : Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 10) / 10;

  return { min, max, avg, median, count: sorted.length };
}

/**
 * GET /api/sessions/:sessionId/summary
 */
export async function getSessionSummary(req, res, next) {
  try {
    const { sessionId } = req.params;

    const session = await MonitoringSession.findOne({ sessionId }).lean();
    if (!session) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'Monitoring session not found'
      });
    }

    const readings = await HealthReading.find({ 'meta.sessionId': sessionId })
      .sort({ ts: 1 })
      .lean();

    const hrValues = readings.map((r) => r.heartRate).filter((v) => v !== null && v > 0);
    const spo2Values = readings.map((r) => r.spo2).filter((v) => v !== null && v > 0);
    const tempValues = readings.map((r) => r.temperatureC).filter((v) => v !== null && v > 0);

    const validReadingsCount = readings.filter(
      (r) => r.valid?.hr && r.valid?.spo2 && r.valid?.temp
    ).length;

    const validDataPercent = readings.length > 0 ? Math.round((validReadingsCount / readings.length) * 100) : 0;

    const startTime = new Date(session.startedAt).getTime();
    const endTime = session.endedAt ? new Date(session.endedAt).getTime() : Date.now();
    const durationMinutes = Math.round((endTime - startTime) / (60 * 1000));

    const alertCount = await Alert.countDocuments({ sessionId });

    return res.status(200).json({
      success: true,
      data: {
        sessionId,
        status: session.status,
        durationMinutes,
        totalReadings: readings.length,
        validDataPercent,
        alertCount,
        stats: {
          heartRate: calculateVitalStats(hrValues),
          spo2: calculateVitalStats(spo2Values),
          temperatureC: calculateVitalStats(tempValues)
        }
      },
      error: null
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/sessions/compare?a=<sessionId>&b=<sessionId>
 * NO clinical interpretation text like "improved"
 */
export async function compareSessions(req, res, next) {
  try {
    const { a: sessionAId, b: sessionBId } = req.query;

    if (!sessionAId || !sessionBId) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Both session query parameters "a" and "b" are required'
      });
    }

    const [sessionA, sessionB] = await Promise.all([
      MonitoringSession.findOne({ sessionId: sessionAId }).lean(),
      MonitoringSession.findOne({ sessionId: sessionBId }).lean()
    ]);

    if (!sessionA || !sessionB) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'One or both sessions were not found'
      });
    }

    const [readingsA, readingsB] = await Promise.all([
      HealthReading.find({ 'meta.sessionId': sessionAId }).lean(),
      HealthReading.find({ 'meta.sessionId': sessionBId }).lean()
    ]);

    const hrA = calculateVitalStats(readingsA.map((r) => r.heartRate).filter((v) => v !== null && v > 0));
    const hrB = calculateVitalStats(readingsB.map((r) => r.heartRate).filter((v) => v !== null && v > 0));

    const spo2A = calculateVitalStats(readingsA.map((r) => r.spo2).filter((v) => v !== null && v > 0));
    const spo2B = calculateVitalStats(readingsB.map((r) => r.spo2).filter((v) => v !== null && v > 0));

    const tempA = calculateVitalStats(readingsA.map((r) => r.temperatureC).filter((v) => v !== null && v > 0));
    const tempB = calculateVitalStats(readingsB.map((r) => r.temperatureC).filter((v) => v !== null && v > 0));

    const warnings = [];
    if (readingsA.length < 10) {
      warnings.push(`Session ${sessionAId} has fewer than 10 total samples, reducing statistical reliability.`);
    }
    if (readingsB.length < 10) {
      warnings.push(`Session ${sessionBId} has fewer than 10 total samples, reducing statistical reliability.`);
    }

    const delta = {
      heartRateAvgDelta: hrA.avg !== null && hrB.avg !== null ? Math.round((hrB.avg - hrA.avg) * 10) / 10 : null,
      spo2AvgDelta: spo2A.avg !== null && spo2B.avg !== null ? Math.round((spo2B.avg - spo2A.avg) * 10) / 10 : null,
      temperatureCAvgDelta:
        tempA.avg !== null && tempB.avg !== null ? Math.round((tempB.avg - tempA.avg) * 10) / 10 : null
    };

    return res.status(200).json({
      success: true,
      data: {
        sessionA: {
          sessionId: sessionA.sessionId,
          startedAt: sessionA.startedAt,
          endedAt: sessionA.endedAt,
          totalReadings: readingsA.length,
          stats: { heartRate: hrA, spo2: spo2A, temperatureC: tempA }
        },
        sessionB: {
          sessionId: sessionB.sessionId,
          startedAt: sessionB.startedAt,
          endedAt: sessionB.endedAt,
          totalReadings: readingsB.length,
          stats: { heartRate: hrB, spo2: spo2B, temperatureC: tempB }
        },
        difference: delta,
        dataQualityWarnings: warnings
      },
      error: null
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Auto-close idle sessions with no incoming telemetry for SESSION_IDLE_MINUTES
 */
export async function closeIdleSessions() {
  const idleMinutes = parseInt(process.env.SESSION_IDLE_MINUTES || '15', 10);
  const cutoff = new Date(Date.now() - idleMinutes * 60 * 1000);

  const activeSessions = await MonitoringSession.find({ status: 'active' });
  for (const session of activeSessions) {
    const latestReading = await HealthReading.findOne({ 'meta.sessionId': session.sessionId })
      .sort({ ts: -1 })
      .select('ts');

    const lastActivity = latestReading ? latestReading.ts : session.startedAt;
    if (lastActivity < cutoff) {
      session.status = 'aborted';
      session.endedAt = new Date();
      session.notes = `${session.notes}\n[System] Session auto-aborted due to ${idleMinutes} minutes of hardware telemetry inactivity.`;
      await session.save();

      await Device.updateOne({ deviceId: session.deviceId }, { currentSessionId: null });
      console.log(`[Auto-Close] Session ${session.sessionId} marked as aborted due to inactivity.`);
    }
  }
}

export default {
  startSession,
  getSessionById,
  stopSession,
  getPatientSessions,
  getPatientReadings,
  getSessionSummary,
  compareSessions,
  closeIdleSessions
};
