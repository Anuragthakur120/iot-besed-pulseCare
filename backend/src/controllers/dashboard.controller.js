import {
  User,
  Device,
  MonitoringSession,
  HealthReading,
  Alert,
  AuditEvent,
  DoctorNote
} from '@pulsecare/database';

/**
 * GET /api/dashboard/doctor-summary
 */
export async function getDoctorSummary(req, res, next) {
  try {
    const totalPatients = await User.countDocuments({ role: 'patient' });
    const activeSessions = await MonitoringSession.countDocuments({ status: 'active' });

    const staleThresholdMs = 30 * 1000;
    const onlineThreshold = new Date(Date.now() - staleThresholdMs);

    const devicesOnline = await Device.countDocuments({
      status: 'active',
      lastHeartbeatAt: { $gte: onlineThreshold }
    });

    const devicesTotal = await Device.countDocuments({});
    const devicesOfflineOrStale = Math.max(0, devicesTotal - devicesOnline);

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const recentVisitsCount = await MonitoringSession.countDocuments({
      startedAt: { $gte: sevenDaysAgo }
    });

    const recentAlerts = await Alert.find({})
      .populate('patientId', 'name patientId')
      .sort({ triggeredAt: -1 })
      .limit(6)
      .lean();

    const recentActivity = await AuditEvent.find({
      action: { $in: ['PATIENT_CREATE', 'SESSION_START', 'ALERT_TRIGGERED', 'AUTH_LOGIN_SUCCESS'] }
    })
      .sort({ at: -1 })
      .limit(8)
      .lean();

    // Top recent patients with their latest telemetry readings
    const patients = await User.find({ role: 'patient' })
      .sort({ updatedAt: -1 })
      .limit(6)
      .lean();

    const patientSummaries = await Promise.all(
      patients.map(async (p) => {
        const latestReading = await HealthReading.findOne({ 'meta.patientId': p._id })
          .sort({ ts: -1 })
          .lean();

        const activeSession = await MonitoringSession.findOne({
          patientId: p._id,
          status: 'active'
        }).lean();

        return {
          ...p,
          latestReading: latestReading || null,
          isMonitoring: Boolean(activeSession),
          activeSessionId: activeSession?.sessionId || null
        };
      })
    );

    return res.status(200).json({
      success: true,
      data: {
        stats: {
          totalPatients,
          activeSessions,
          devicesOnline,
          devicesOfflineOrStale,
          recentVisitsCount,
          activeAlertsCount: await Alert.countDocuments({ resolvedAt: null })
        },
        patients: patientSummaries,
        recentAlerts,
        recentActivity
      },
      error: null
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/dashboard/patient-summary
 */
export async function getPatientSummary(req, res, next) {
  try {
    const patientId = req.user.role === 'patient' ? req.user._id : req.query.patientId || req.user._id;

    const patient = await User.findById(patientId).lean();
    if (!patient) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'Patient record not found'
      });
    }

    // Latest valid readings
    const latestReading = await HealthReading.findOne({ 'meta.patientId': patient._id })
      .sort({ ts: -1 })
      .lean();

    // Past 2 completed sessions for visit comparison
    const recentSessions = await MonitoringSession.find({
      patientId: patient._id,
      status: 'completed'
    })
      .sort({ startedAt: -1 })
      .limit(2)
      .lean();

    const currentVisit = recentSessions[0] || null;
    const previousVisit = recentSessions[1] || null;

    // Active or recent alerts
    const alerts = await Alert.find({ patientId: patient._id })
      .sort({ triggeredAt: -1 })
      .limit(5)
      .lean();

    // Notes visible to patient
    const notes = await DoctorNote.find({ patientId: patient._id, visibleToPatient: true })
      .populate('authorId', 'name role')
      .sort({ createdAt: -1 })
      .limit(3)
      .lean();

    return res.status(200).json({
      success: true,
      data: {
        patient,
        latestReading: latestReading
          ? {
              ts: latestReading.ts,
              heartRate: latestReading.valid?.hr ? latestReading.heartRate : null,
              spo2: latestReading.valid?.spo2 ? latestReading.spo2 : null,
              temperatureC: latestReading.valid?.temp ? latestReading.temperatureC : null,
              fingerDetected: latestReading.fingerDetected,
              signalQuality: latestReading.signalQuality,
              isDemo: latestReading.isDemo
            }
          : null,
        currentVisit,
        previousVisit,
        alerts,
        notes
      },
      error: null
    });
  } catch (error) {
    next(error);
  }
}

export default {
  getDoctorSummary,
  getPatientSummary
};
