import { Router } from 'express';
import {
  withdrawConsent,
  exportPatientData,
  requestAccountDeletion,
  cancelAccountDeletion,
  subscribeWebPush
} from '../controllers/privacy.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

// Consent & Data Rights
router.post('/consent-withdraw', withdrawConsent);
router.get('/export-data', exportPatientData);
router.post('/delete-request', requestAccountDeletion);
router.post('/cancel-delete', cancelAccountDeletion);

// Web Push Registration
router.post('/notifications/subscribe', subscribeWebPush);

export default router;
