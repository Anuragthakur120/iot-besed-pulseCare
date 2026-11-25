import { Router } from 'express';
import * as dashboardController from '../controllers/dashboard.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

// Doctor Ward Metrics Summary
router.get(
  '/doctor-summary',
  authenticate,
  requireRole('doctor', 'admin'),
  dashboardController.getDoctorSummary
);

// Individual Patient Vitals & Visit Summary
router.get(
  '/patient-summary',
  authenticate,
  dashboardController.getPatientSummary
);

export default router;
