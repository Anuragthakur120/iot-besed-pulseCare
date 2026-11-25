import { Router } from 'express';
import multer from 'multer';
import * as patientController from '../controllers/patient.controller.js';
import * as sessionController from '../controllers/session.controller.js';
import {
  authenticate,
  requireRole,
  requirePatientAccess
} from '../middleware/auth.js';

const router = Router();

// Configure Multer with Memory Storage & 2MB Limit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024 // 2 Megabytes
  }
});

// 1. List Patients (Doctor/Admin)
router.get('/', authenticate, requireRole('doctor', 'admin'), patientController.getPatients);

// 2. Register Patient by Clinician (Doctor/Admin)
router.post('/', authenticate, requireRole('doctor', 'admin'), patientController.createPatient);

// 3. Patient Photo endpoints (Place before /:patientId wildcard)
router.get('/:patientId/photo', patientController.getPatientPhoto);
router.post(
  '/:patientId/photo',
  authenticate,
  requirePatientAccess,
  upload.single('photo'),
  patientController.uploadPatientPhoto
);
router.delete(
  '/:patientId/photo',
  authenticate,
  requirePatientAccess,
  patientController.deletePatientPhotoController
);

// 4. Clinical Notes endpoints
router.get('/:patientId/notes', authenticate, requirePatientAccess, patientController.getPatientNotes);
router.post(
  '/:patientId/notes',
  authenticate,
  requireRole('doctor', 'admin'),
  patientController.createPatientNote
);

// 5. Patient Telemetry Sessions & Readings
router.get('/:patientId/sessions', authenticate, requirePatientAccess, sessionController.getPatientSessions);
router.get('/:patientId/readings', authenticate, requirePatientAccess, sessionController.getPatientReadings);

// 6. Individual Patient Details
router.get('/:patientId', authenticate, requirePatientAccess, patientController.getPatientById);
router.patch('/:patientId', authenticate, requirePatientAccess, patientController.updatePatient);

export default router;
