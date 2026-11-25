import { Router } from 'express';
import * as sessionController from '../controllers/session.controller.js';
import { getSessionPdfReport, getSessionReadingsCsv } from '../controllers/report.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

// Compare two monitoring sessions
router.get('/compare', authenticate, sessionController.compareSessions);

// Start new clinical monitoring session (Doctor/Admin)
router.post('/', authenticate, requireRole('doctor', 'admin'), sessionController.startSession);

// Clinical PDF & CSV Report Downloads
router.get('/:sessionId/report.pdf', authenticate, getSessionPdfReport);
router.get('/:sessionId/readings.csv', authenticate, getSessionReadingsCsv);

// Individual session details
router.get('/:sessionId', authenticate, sessionController.getSessionById);

// Stop active session (Doctor/Admin)
router.post('/:sessionId/stop', authenticate, requireRole('doctor', 'admin'), sessionController.stopSession);

// Session statistical summary
router.get('/:sessionId/summary', authenticate, sessionController.getSessionSummary);

export default router;
