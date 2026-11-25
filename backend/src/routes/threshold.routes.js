import { Router } from 'express';
import { getThresholds, updateThresholds } from '../controllers/alert.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

// Doctor/Admin only routes for threshold profile management
router.get('/', authenticate, requireRole('doctor', 'admin'), getThresholds);
router.put('/', authenticate, requireRole('doctor', 'admin'), updateThresholds);

export default router;
