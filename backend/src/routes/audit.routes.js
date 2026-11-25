import { Router } from 'express';
import { getAuditLogs } from '../controllers/audit.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

// GET /api/audit - System Audit Logs (Admin only)
router.get('/', authenticate, requireRole('admin'), getAuditLogs);

export default router;
