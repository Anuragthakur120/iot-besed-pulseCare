import { Router } from 'express';
import {
  listUsers,
  inviteDoctor,
  updateUserStatus,
  forcePasswordReset,
  updateUserRole,
  getThresholdTemplates,
  updateThresholdTemplate,
  getSystemStatus
} from '../controllers/admin.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

// Protect all admin routes strictly for role 'admin'
router.use(authenticate, requireRole('admin'));

// User Management
router.get('/users', listUsers);
router.post('/invitations', inviteDoctor);
router.patch('/users/:id/status', updateUserStatus);
router.post('/users/:id/force-reset', forcePasswordReset);
router.patch('/users/:id/role', updateUserRole);

// Age-based Threshold Templates
router.get('/threshold-templates', getThresholdTemplates);
router.put('/threshold-templates/:ageGroup', updateThresholdTemplate);

// System Status & Diagnostics
router.get('/system/status', getSystemStatus);

export default router;
