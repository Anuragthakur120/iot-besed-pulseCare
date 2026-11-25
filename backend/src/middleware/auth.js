import { User } from '@pulsecare/database';
import { verifyAccessToken } from '../utils/tokens.js';

/**
 * Middleware: Verify Bearer JWT Access Token and attach authenticated User to req.user
 */
export async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        data: null,
        error: 'Authentication token required'
      });
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          data: null,
          error: 'Access token expired',
          code: 'TOKEN_EXPIRED'
        });
      }
      return res.status(401).json({
        success: false,
        data: null,
        error: 'Invalid authentication token'
      });
    }

    const user = await User.findById(decoded.id).select('+passwordHash');
    if (!user) {
      return res.status(401).json({
        success: false,
        data: null,
        error: 'Account no longer exists'
      });
    }

    if (user.status === 'disabled') {
      const isCancelingDeletion = req.originalUrl?.includes('/api/privacy/cancel-delete') && user.deletionScheduledAt;
      if (!isCancelingDeletion) {
        return res.status(403).json({
          success: false,
          data: null,
          error: 'Account has been suspended. Please contact hospital administrator.'
        });
      }
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Middleware: Restrict access to designated roles
 * @param {...string} roles - e.g. 'admin', 'doctor'
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        data: null,
        error: 'Authentication required'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        data: null,
        error: 'Access denied: Insufficient permissions for this resource'
      });
    }

    next();
  };
}

/**
 * Middleware: Enforce clinical boundary for patients
 * Patient can only access their own patientId; doctor/admin can access any.
 * ALWAYS derives patientId from token for patient role and ignores spoofed values in URL/body.
 */
export function requirePatientAccess(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      data: null,
      error: 'Authentication required'
    });
  }

  // Doctors and Admins have authorized clinical access across patients
  if (['doctor', 'admin'].includes(req.user.role)) {
    return next();
  }

  // For Patient role:
  const requestedId = req.params.patientId || req.query.patientId || req.body?.patientId;
  const userPatientId = req.user.patientId;

  // If URL explicitly attempted to target a different patient, reject
  if (requestedId && requestedId !== userPatientId && requestedId !== req.user._id.toString()) {
    return res.status(403).json({
      success: false,
      data: null,
      error: 'Access denied: Patients can only access their own clinical records'
    });
  }

  // Securely force patientId to user's own identifier
  req.params.patientId = userPatientId;
  if (req.body && typeof req.body === 'object') {
    req.body.patientId = userPatientId;
  }
  if (req.query && typeof req.query === 'object') {
    req.query.patientId = userPatientId;
  }

  next();
}

/**
 * Middleware: Force password change if mustChangePassword is true
 * Blocks everything except change-password, logout, and me.
 */
export function requireFreshPassword(req, res, next) {
  if (req.user && req.user.mustChangePassword) {
    const allowedPaths = [
      '/api/auth/change-password',
      '/api/auth/logout',
      '/api/auth/logout-all',
      '/api/auth/me'
    ];

    const isAllowed = allowedPaths.some((p) => req.originalUrl.startsWith(p));
    if (!isAllowed) {
      return res.status(403).json({
        success: false,
        data: null,
        error: 'Password reset required. You must change your default password before proceeding.',
        code: 'MUST_CHANGE_PASSWORD'
      });
    }
  }

  next();
}

export default {
  authenticate,
  requireRole,
  requirePatientAccess,
  requireFreshPassword
};
