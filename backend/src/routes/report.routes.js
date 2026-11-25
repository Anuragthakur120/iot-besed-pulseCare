import { Router } from 'express';
import {
  getSessionPdfReport,
  getSessionReadingsCsv,
  generateSignedReportUrl,
  getResearchCsvExport
} from '../controllers/report.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

// POST /api/reports/generate - Generate signed report URL (5 min)
router.post('/generate', authenticate, generateSignedReportUrl);

// GET /api/reports/research-export.csv - Anonymized research dataset (Admin only)
router.get('/research-export.csv', authenticate, requireRole('admin'), getResearchCsvExport);

// Direct session report aliases under /api/reports/:sessionId/
router.get('/:sessionId/pdf', authenticate, getSessionPdfReport);
router.get('/:sessionId/csv', authenticate, getSessionReadingsCsv);

export default router;
