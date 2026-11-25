import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const archiver = require('archiver');
import { User, MonitoringSession, HealthReading, DoctorNote, Alert } from '@pulsecare/database';
import { logAudit } from '../middleware/audit.js';
import { escapeCsvFormula } from './report.controller.js';
import env from '../config/env.js';

/**
 * POST /api/privacy/consent-withdraw
 * Patient withdraws digital health data consent
 */
export async function withdrawConsent(req, res, next) {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, data: null, error: 'User not found' });
    }

    user.consentWithdrawnAt = new Date();
    await user.save();

    await logAudit(req, {
      action: 'CONSENT_WITHDRAW',
      targetType: 'User',
      targetId: user._id.toString(),
      meta: { patientId: user.patientId, email: user.email }
    });

    return res.status(200).json({
      success: true,
      data: {
        consentWithdrawnAt: user.consentWithdrawnAt,
        message: 'Consent withdrawn. Real-time telemetry monitoring for this profile is halted.'
      },
      error: null
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/privacy/export-data
 * GDPR/HIPAA Patient Data Portability Export (Streams ZIP with JSON & CSV files)
 */
export async function exportPatientData(req, res, next) {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId).select('-passwordHash').lean();

    if (!user) {
      return res.status(404).json({ success: false, data: null, error: 'User not found' });
    }

    await logAudit(req, {
      action: 'DATA_EXPORT',
      targetType: 'User',
      targetId: user._id.toString(),
      meta: { patientId: user.patientId }
    });

    // Fetch related patient datasets
    const [sessions, readings, doctorNotes, alerts] = await Promise.all([
      MonitoringSession.find({ patientId: userId }).lean(),
      HealthReading.find({ 'meta.patientId': userId }).sort({ ts: 1 }).limit(10000).lean(),
      DoctorNote.find({ patientId: userId, visibleToPatient: true }).lean(),
      Alert.find({ patientId: userId }).lean()
    ]);

    // Build CSV of telemetry readings
    const csvHeaders = ['timestamp_utc', 'hr_bpm', 'spo2_percent', 'temp_c', 'finger_detected', 'signal_quality'];
    const csvRows = readings.map((r) => [
      escapeCsvFormula(r.ts ? new Date(r.ts).toISOString() : ''),
      escapeCsvFormula(r.heartRate ?? ''),
      escapeCsvFormula(r.spo2 ?? ''),
      escapeCsvFormula(r.temperatureC ?? ''),
      escapeCsvFormula(r.fingerDetected ? '1' : '0'),
      escapeCsvFormula(r.signalQuality ?? '')
    ].join(','));
    const telemetryCsv = [csvHeaders.join(','), ...csvRows].join('\r\n');

    // Set response headers for ZIP download
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="PulseCare-Data-Export-${user.patientId || 'patient'}.zip"`);

    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.on('error', (err) => {
      console.error('[DataExport] Archiver error:', err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: 'Failed to archive data bundle' });
      }
    });

    archive.pipe(res);

    // Append Profile JSON
    archive.append(JSON.stringify(user, null, 2), { name: 'patient-profile.json' });

    // Append Sessions JSON
    archive.append(JSON.stringify(sessions, null, 2), { name: 'monitoring-sessions.json' });

    // Append Doctor Notes JSON
    archive.append(JSON.stringify(doctorNotes, null, 2), { name: 'clinical-notes.json' });

    // Append Alerts JSON
    archive.append(JSON.stringify(alerts, null, 2), { name: 'alerts-history.json' });

    // Append Telemetry CSV
    archive.append(telemetryCsv, { name: 'telemetry-readings.csv' });

    await archive.finalize();
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/privacy/delete-request
 * Patient requests account deletion with 7-day cooling period
 */
export async function requestAccountDeletion(req, res, next) {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, data: null, error: 'User not found' });
    }

    const coolingDays = env.DELETION_COOLING_DAYS || 7;
    user.deletionRequestedAt = new Date();
    user.deletionScheduledAt = new Date(Date.now() + coolingDays * 24 * 60 * 60 * 1000);
    user.status = 'disabled'; // disable during cooling period
    await user.save();

    await logAudit(req, {
      action: 'ACCOUNT_DELETION_REQUEST',
      targetType: 'User',
      targetId: user._id.toString(),
      meta: { deletionScheduledAt: user.deletionScheduledAt }
    });

    return res.status(200).json({
      success: true,
      data: {
        deletionRequestedAt: user.deletionRequestedAt,
        deletionScheduledAt: user.deletionScheduledAt,
        coolingPeriodDays: coolingDays,
        message: `Account scheduled for permanent erasure on ${user.deletionScheduledAt.toLocaleDateString()}. You may cancel anytime before this date.`
      },
      error: null
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/privacy/cancel-delete
 * Cancel deletion request and restore active status
 */
export async function cancelAccountDeletion(req, res, next) {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, data: null, error: 'User not found' });
    }

    user.deletionRequestedAt = null;
    user.deletionScheduledAt = null;
    user.status = 'active';
    await user.save();

    await logAudit(req, {
      action: 'ACCOUNT_DELETION_CANCEL',
      targetType: 'User',
      targetId: user._id.toString()
    });

    return res.status(200).json({
      success: true,
      data: {
        status: user.status,
        message: 'Account deletion request successfully cancelled. Account restored.'
      },
      error: null
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/notifications/subscribe
 * Register Web Push Subscription for PWA background alarms
 */
export async function subscribeWebPush(req, res, next) {
  try {
    const { subscription } = req.body;
    if (!subscription) {
      return res.status(400).json({ success: false, data: null, error: 'Subscription payload is required' });
    }

    const user = await User.findById(req.user._id);
    if (user) {
      user.pushSubscription = subscription;
      await user.save();
    }

    return res.status(200).json({
      success: true,
      data: { subscribed: true },
      error: null
    });
  } catch (error) {
    next(error);
  }
}
