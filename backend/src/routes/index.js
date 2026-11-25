import { Router } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import patientRoutes from './patient.routes.js';
import dashboardRoutes from './dashboard.routes.js';
import sessionRoutes from './session.routes.js';
import deviceRoutes from './device.routes.js';
import alertRoutes from './alert.routes.js';
import thresholdRoutes from './threshold.routes.js';
import reportRoutes from './report.routes.js';
import auditRoutes from './audit.routes.js';
import adminRoutes from './admin.routes.js';
import appointmentRoutes from './appointment.routes.js';
import privacyRoutes from './privacy.routes.js';
import {
  authenticate,
  requireRole,
  requirePatientAccess,
  requireFreshPassword
} from '../middleware/auth.js';

const apiRouter = Router();

// Mount Health Check endpoints (/api/health and /api/ready)
apiRouter.use('/health', healthRoutes);
apiRouter.use('/ready', healthRoutes);

// Mount Authentication endpoints (/api/auth)
apiRouter.use('/auth', authRoutes);

// Mount Patient Management & Charts endpoints (/api/patients)
apiRouter.use('/patients', patientRoutes);

// Mount Clinical & Patient Dashboard Metrics (/api/dashboard)
apiRouter.use('/dashboard', dashboardRoutes);

// Mount Telemetry Monitoring Sessions (/api/sessions)
apiRouter.use('/sessions', sessionRoutes);

// Mount IoT Hardware Devices (/api/devices and /api/device)
apiRouter.use('/devices', deviceRoutes);
apiRouter.use('/device', deviceRoutes);

// Mount Alerts & Alarms (/api/alerts)
apiRouter.use('/alerts', alertRoutes);

// Mount Clinical Threshold Profiles (/api/thresholds)
apiRouter.use('/thresholds', thresholdRoutes);

// Mount Clinical Reports & Research Data (/api/reports)
apiRouter.use('/reports', reportRoutes);

// Mount Audit Trail Log Viewer (/api/audit)
apiRouter.use('/audit', auditRoutes);

// Mount Admin Management & System Governance (/api/admin)
apiRouter.use('/admin', adminRoutes);

// Mount Clinical Appointments & Scheduling (/api/appointments)
apiRouter.use('/appointments', appointmentRoutes);

// Mount GDPR/HIPAA Privacy, Consent & Portability (/api/privacy)
apiRouter.use('/privacy', privacyRoutes);

// Test verification endpoints for middleware unit verification
if (process.env.NODE_ENV === 'test') {
  apiRouter.get('/test/doctor-only', authenticate, requireRole('doctor', 'admin'), (_req, res) => {
    res.json({ success: true, data: 'Welcome Doctor' });
  });

  apiRouter.get('/test/patient-records/:patientId', authenticate, requirePatientAccess, (req, res) => {
    res.json({ success: true, data: { patientId: req.params.patientId } });
  });

  apiRouter.get('/test/sensitive-resource', authenticate, requireFreshPassword, (_req, res) => {
    res.json({ success: true, data: 'Access granted' });
  });
}

export default apiRouter;
