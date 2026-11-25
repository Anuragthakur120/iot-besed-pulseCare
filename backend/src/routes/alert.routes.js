import { Router } from 'express';
import { getAlerts, acknowledgeAlert } from '../controllers/alert.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

// GET /api/alerts - List alerts (filtered, patient-isolated, or clinician view)
router.get('/', authenticate, getAlerts);

// POST /api/alerts/:id/acknowledge - Clinician acknowledges alert with note
router.post('/:id/acknowledge', authenticate, requireRole('doctor', 'admin'), acknowledgeAlert);

export default router;
