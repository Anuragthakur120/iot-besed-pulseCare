import mongoose from 'mongoose';
import { Alert, ThresholdProfile, User, MonitoringSession } from '@pulsecare/database';
import { logAudit } from '../middleware/audit.js';

/**
 * GET /api/alerts
 * List alerts with multi-dimensional filtering, pagination, and role-based access
 */
export async function getAlerts(req, res, next) {
  try {
    const {
      patientId,
      sessionId,
      type,
      status = 'all',
      severity,
      from,
      to,
      page = 1,
      limit = 20
    } = req.query;

    const query = {};

    // Patient isolation: patients can ONLY view their own alerts
    if (req.user.role === 'patient') {
      query.patientId = req.user._id;
    } else if (patientId) {
      if (mongoose.Types.ObjectId.isValid(patientId)) {
        query.patientId = patientId;
      } else {
        const patientUser = await User.findOne({ patientId }).select('_id');
        if (patientUser) {
          query.patientId = patientUser._id;
        } else {
          return res.status(200).json({
            success: true,
            data: {
              alerts: [],
              pagination: { total: 0, page: Number(page), limit: Number(limit), pages: 0 },
              stats: { open: 0, critical: 0 }
            },
            error: null
          });
        }
      }
    }

    if (sessionId) {
      query.sessionId = sessionId;
    }

    if (type) {
      query.type = type;
    }

    if (severity) {
      query.severity = severity;
    }

    // Status filter: 'open' | 'acknowledged' | 'resolved' | 'all'
    if (status === 'open') {
      query.resolvedAt = null;
    } else if (status === 'acknowledged') {
      query.acknowledgedAt = { $ne: null };
    } else if (status === 'resolved') {
      query.resolvedAt = { $ne: null };
    }

    // Date range filter
    if (from || to) {
      query.triggeredAt = {};
      if (from) query.triggeredAt.$gte = new Date(from);
      if (to) query.triggeredAt.$lte = new Date(to);
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [alerts, total, openCount, criticalCount] = await Promise.all([
      Alert.find(query)
        .populate('patientId', 'patientId name email')
        .populate('acknowledgedBy', 'name role')
        .sort({ triggeredAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Alert.countDocuments(query),
      Alert.countDocuments({ ...query, resolvedAt: null }),
      Alert.countDocuments({ ...query, resolvedAt: null, severity: 'critical' })
    ]);

    // Format alerts with plain language descriptions for patients
    const formattedAlerts = alerts.map((a) => {
      const isPatient = req.user.role === 'patient';
      let plainLanguage = '';

      switch (a.type) {
        case 'HR_HIGH':
          plainLanguage = `Your heart rate was higher than usual (${a.value || ''} bpm).`;
          break;
        case 'HR_LOW':
          plainLanguage = `Your heart rate was lower than usual (${a.value || ''} bpm).`;
          break;
        case 'SPO2_LOW':
          plainLanguage = `Your blood oxygen saturation dipped below safe range (${a.value || ''}%).`;
          break;
        case 'TEMP_HIGH':
          plainLanguage = `Your body temperature indicated an elevated reading (${a.value || ''} °C).`;
          break;
        case 'TEMP_LOW':
          plainLanguage = `Your body temperature was below normal range (${a.value || ''} °C).`;
          break;
        case 'TREND_HR':
          plainLanguage = 'A rapid change in your heart rate pattern was observed.';
          break;
        case 'DEVICE_DISCONNECTED':
          plainLanguage = 'Your monitoring device briefly lost communication.';
          break;
        case 'INVALID_DATA':
          plainLanguage = 'Sensor contact was unstable or finger was momentarily detached.';
          break;
        default:
          plainLanguage = 'A health monitoring alert was registered.';
      }

      return {
        ...a,
        plainLanguage: isPatient ? plainLanguage : undefined,
        patient: a.patientId
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        alerts: formattedAlerts,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          pages: Math.ceil(total / limitNum) || 1
        },
        stats: {
          open: openCount,
          critical: criticalCount
        }
      },
      error: null
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/alerts/:id/acknowledge
 * Acknowledge an alarm with optional clinical note
 */
export async function acknowledgeAlert(req, res, next) {
  try {
    const { id } = req.params;
    const { note } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Invalid alert ID format'
      });
    }

    const alert = await Alert.findById(id).populate('patientId', 'patientId name');
    if (!alert) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'Alert not found'
      });
    }

    alert.acknowledgedBy = req.user._id;
    alert.acknowledgedAt = new Date();
    if (note) {
      alert.note = String(note).trim();
      alert.acknowledgedNote = String(note).trim();
    }
    await alert.save();

    // Log audit event
    await logAudit(req, {
      action: 'ALERT_ACKNOWLEDGE',
      targetType: 'Alert',
      targetId: alert._id.toString(),
      meta: {
        alertType: alert.type,
        severity: alert.severity,
        sessionId: alert.sessionId,
        note: note ? String(note).trim() : null
      }
    });

    // Emit Socket.IO event
    const io = req.app.get('io');
    if (io) {
      const payload = {
        ...alert.toObject(),
        acknowledgedBy: { _id: req.user._id, name: req.user.name, role: req.user.role }
      };
      io.to('ops').emit('alert:updated', payload);
      if (alert.patientId?.patientId) {
        io.to(`patient:${alert.patientId.patientId}`).emit('alert:updated', payload);
      }
    }

    return res.status(200).json({
      success: true,
      data: { alert },
      error: null
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/thresholds
 * Retrieve baseline and per-patient threshold profiles (Doctor / Admin)
 */
export async function getThresholds(req, res, next) {
  try {
    const { patientId } = req.query;

    if (patientId) {
      let patientDoc = null;
      if (mongoose.Types.ObjectId.isValid(patientId)) {
        patientDoc = await User.findById(patientId);
      } else {
        patientDoc = await User.findOne({ patientId });
      }

      const patientProfile = patientDoc
        ? await ThresholdProfile.findOne({ scope: 'patient', patientId: patientDoc._id })
        : null;

      const defaultProfile = await ThresholdProfile.findOne({ scope: 'default' });

      return res.status(200).json({
        success: true,
        data: {
          profile: patientProfile || defaultProfile,
          isCustom: Boolean(patientProfile)
        },
        error: null
      });
    }

    const [defaultProfile, customProfiles] = await Promise.all([
      ThresholdProfile.findOne({ scope: 'default' }),
      ThresholdProfile.find({ scope: 'patient' }).populate('patientId', 'patientId name email').lean()
    ]);

    return res.status(200).json({
      success: true,
      data: {
        defaultProfile: defaultProfile || {
          name: 'Standard Adult ICU Profile',
          scope: 'default',
          hrMin: 50,
          hrMax: 120,
          spo2Min: 92,
          tempMin: 35.5,
          tempMax: 38.0,
          persistenceSeconds: 5,
          trendRule: { windowMinutes: 15, percentChange: 20 }
        },
        patientProfiles: customProfiles
      },
      error: null
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/thresholds
 * Update or create threshold profiles (Doctor / Admin)
 * Validates: hrMin < hrMax, tempMin < tempMax, spo2Min >= 50, persistenceSeconds >= 0
 */
export async function updateThresholds(req, res, next) {
  try {
    const {
      scope = 'default',
      patientId,
      name,
      hrMin,
      hrMax,
      spo2Min,
      tempMin,
      tempMax,
      persistenceSeconds = 5,
      trendRule
    } = req.body;

    // Numerical validation
    const numHrMin = Number(hrMin);
    const numHrMax = Number(hrMax);
    const numSpo2Min = Number(spo2Min);
    const numTempMin = Number(tempMin);
    const numTempMax = Number(tempMax);
    const numPersistence = Number(persistenceSeconds);

    if (numHrMin >= numHrMax) {
      return res.status(400).json({
        success: false,
        data: null,
        error: `Heart rate minimum (${numHrMin}) must be strictly less than maximum (${numHrMax})`
      });
    }

    if (numTempMin >= numTempMax) {
      return res.status(400).json({
        success: false,
        data: null,
        error: `Temperature minimum (${numTempMin}) must be strictly less than maximum (${numTempMax})`
      });
    }

    if (numSpo2Min < 50 || numSpo2Min > 100) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'SpO2 minimum threshold must be between 50% and 100%'
      });
    }

    if (numPersistence < 0) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Persistence seconds cannot be negative'
      });
    }

    const validatedTrendRule = {
      windowMinutes: Math.max(1, Number(trendRule?.windowMinutes) || 15),
      percentChange: Math.max(1, Number(trendRule?.percentChange) || 20)
    };

    let targetPatientId = null;
    if (scope === 'patient') {
      if (!patientId) {
        return res.status(400).json({
          success: false,
          data: null,
          error: 'patientId is required when scope is set to patient'
        });
      }

      let patientUser = null;
      if (mongoose.Types.ObjectId.isValid(patientId)) {
        patientUser = await User.findById(patientId);
      } else {
        patientUser = await User.findOne({ patientId });
      }

      if (!patientUser) {
        return res.status(404).json({
          success: false,
          data: null,
          error: `Patient ${patientId} not found`
        });
      }
      targetPatientId = patientUser._id;
    }

    const filter = scope === 'patient'
      ? { scope: 'patient', patientId: targetPatientId }
      : { scope: 'default' };

    const updateData = {
      name: name || (scope === 'patient' ? 'Custom Patient Profile' : 'Standard Ward Profile'),
      scope,
      patientId: targetPatientId,
      hrMin: numHrMin,
      hrMax: numHrMax,
      spo2Min: numSpo2Min,
      tempMin: numTempMin,
      tempMax: numTempMax,
      persistenceSeconds: numPersistence,
      trendRule: validatedTrendRule
    };

    const profile = await ThresholdProfile.findOneAndUpdate(
      filter,
      updateData,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Audit log
    await logAudit(req, {
      action: 'THRESHOLD_CHANGE',
      targetType: 'ThresholdProfile',
      targetId: profile._id.toString(),
      meta: {
        scope,
        patientId: targetPatientId ? targetPatientId.toString() : null,
        hrMin: numHrMin,
        hrMax: numHrMax,
        spo2Min: numSpo2Min,
        tempMin: numTempMin,
        tempMax: numTempMax,
        persistenceSeconds: numPersistence
      }
    });

    return res.status(200).json({
      success: true,
      data: { profile },
      error: null
    });
  } catch (error) {
    next(error);
  }
}
