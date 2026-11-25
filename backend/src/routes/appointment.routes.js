import { Router } from 'express';
import {
  getAppointments,
  createAppointment,
  cancelAppointment
} from '../controllers/appointment.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

// List appointments for patient or doctor
router.get('/', getAppointments);

// Doctor schedules next consultation
router.post('/', requireRole('doctor', 'admin'), createAppointment);

// Cancel appointment
router.patch('/:id/cancel', cancelAppointment);

export default router;
