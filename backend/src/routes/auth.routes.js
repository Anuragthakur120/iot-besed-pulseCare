import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as authController from '../controllers/auth.controller.js';
import {
  authenticate,
  requireFreshPassword
} from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  registerSchema,
  loginSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  acceptInviteSchema
} from '../validators/auth.validators.js';

const router = Router();

// Brute-force rate limiter for login: max 5 attempts per minute per IP + email
const loginLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  keyGenerator: (req) => `${req.ip}_${req.body?.email || 'anonymous'}`,
  message: {
    success: false,
    data: null,
    error: 'Too many login attempts. Please wait 1 minute before trying again.'
  }
});

// General auth rate limiter for password reset requests: max 5 per 15 min per IP
const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    data: null,
    error: 'Too many password reset requests from this IP. Please try again later.'
  }
});

// 1. Register Patient (Patients only)
router.post('/register', validate(registerSchema), authController.register);

// 2. Login
router.post('/login', loginLimiter, validate(loginSchema), authController.login);

// 3. Refresh Access Token
router.post('/refresh', authController.refresh);

// 4. Logout Current Session
router.post('/logout', authController.logout);

// 5. Logout All Active Sessions
router.post('/logout-all', authenticate, authController.logoutAll);

// 6. Get Current User Profile
router.get('/me', authenticate, requireFreshPassword, authController.getMe);

// 7. Change Password
router.post(
  '/change-password',
  authenticate,
  validate(changePasswordSchema),
  authController.changePassword
);

// 8. Forgot Password
router.post(
  '/forgot-password',
  passwordResetLimiter,
  validate(forgotPasswordSchema),
  authController.forgotPassword
);

// 9. Reset Password
router.post(
  '/reset-password',
  validate(resetPasswordSchema),
  authController.resetPassword
);

// 10. Accept Staff Invitation
router.post(
  '/accept-invite',
  validate(acceptInviteSchema),
  authController.acceptInvite
);

export default router;
