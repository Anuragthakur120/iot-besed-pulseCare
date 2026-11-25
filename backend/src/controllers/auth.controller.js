import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import {
  User,
  RefreshSession,
  PasswordResetToken,
  Invitation
} from '@pulsecare/database';
import {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
  getRefreshCookieOptions
} from '../utils/tokens.js';
import { logAudit } from '../middleware/audit.js';
import { sendPasswordResetEmail } from '../utils/mailer.js';
import env from '../config/env.js';

const BCRYPT_ROUNDS = 12;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

/**
 * POST /api/auth/register (Patients only)
 */
export async function register(req, res, next) {
  try {
    const { name, email, password, dob, phone } = req.body;

    const existingUser = await User.findOne({ email }).select('_id');
    if (existingUser) {
      return res.status(409).json({
        success: false,
        data: null,
        error: 'An account with this email address already exists'
      });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const newUser = await User.create({
      name,
      email,
      passwordHash,
      role: 'patient', // role forced to patient
      dob,
      phone: phone || '',
      consentAcceptedAt: new Date(),
      status: 'active',
      mustChangePassword: false
    });

    const accessToken = generateAccessToken(newUser);
    const rawRefreshToken = generateRefreshToken();
    const tokenHash = hashToken(rawRefreshToken);

    await RefreshSession.create({
      userId: newUser._id,
      tokenHash,
      userAgent: req.get('user-agent') || '',
      ip: req.ip || '',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });

    res.cookie('refreshToken', rawRefreshToken, getRefreshCookieOptions(true));

    await logAudit({
      req,
      action: 'USER_REGISTER',
      targetType: 'User',
      targetId: newUser._id,
      meta: { email: newUser.email, role: 'patient' },
      actor: newUser
    });

    return res.status(201).json({
      success: true,
      data: {
        user: newUser,
        accessToken
      },
      error: null
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/login
 */
export async function login(req, res, next) {
  try {
    const { email, password, rememberMe = true } = req.body;

    const user = await User.findOne({ email }).select('+passwordHash');

    // 1. Check if user account is temporarily locked
    if (user && user.lockUntil && user.lockUntil > new Date()) {
      const remainingMinutes = Math.ceil((user.lockUntil.getTime() - Date.now()) / (60 * 1000));
      return res.status(423).json({
        success: false,
        data: null,
        error: `Account is temporarily locked due to multiple failed login attempts. Please try again in ${remainingMinutes} minute(s).`
      });
    }

    // 2. Validate user existence and status
    if (!user || user.status === 'disabled') {
      await logAudit({
        req,
        action: 'AUTH_LOGIN_FAILURE',
        targetType: 'User',
        meta: { email, reason: 'Invalid user or disabled' }
      });
      return res.status(401).json({
        success: false,
        data: null,
        error: 'Invalid email or password'
      });
    }

    // 3. Verify password
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      user.failedLoginCount = (user.failedLoginCount || 0) + 1;
      if (user.failedLoginCount >= MAX_LOGIN_ATTEMPTS) {
        user.lockUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
      }
      await user.save();

      await logAudit({
        req,
        action: 'AUTH_LOGIN_FAILURE',
        targetType: 'User',
        targetId: user._id,
        meta: { email, failedAttempts: user.failedLoginCount }
      });

      if (user.lockUntil && user.lockUntil > new Date()) {
        return res.status(423).json({
          success: false,
          data: null,
          error: `Account is temporarily locked due to multiple failed login attempts. Please try again in ${LOCKOUT_MINUTES} minutes.`
        });
      }

      return res.status(401).json({
        success: false,
        data: null,
        error: 'Invalid email or password'
      });
    }

    // 4. Successful login: reset failed counters
    user.failedLoginCount = 0;
    user.lockUntil = null;
    user.lastLoginAt = new Date();
    await user.save();

    // 5. Generate tokens
    const accessToken = generateAccessToken(user);
    const rawRefreshToken = generateRefreshToken();
    const tokenHash = hashToken(rawRefreshToken);

    const ttlMs = rememberMe ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    await RefreshSession.create({
      userId: user._id,
      tokenHash,
      userAgent: req.get('user-agent') || '',
      ip: req.ip || '',
      expiresAt: new Date(Date.now() + ttlMs)
    });

    res.cookie('refreshToken', rawRefreshToken, getRefreshCookieOptions(rememberMe));

    await logAudit({
      req,
      action: 'AUTH_LOGIN_SUCCESS',
      targetType: 'User',
      targetId: user._id,
      meta: { email: user.email, role: user.role },
      actor: user
    });

    return res.status(200).json({
      success: true,
      data: {
        user,
        accessToken
      },
      error: null
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/refresh (Token Rotation + Reuse Detection)
 */
export async function refresh(req, res, next) {
  try {
    const rawToken = req.cookies?.refreshToken || req.body?.refreshToken;

    if (!rawToken) {
      return res.status(401).json({
        success: false,
        data: null,
        error: 'Refresh token is missing'
      });
    }

    const tokenHash = hashToken(rawToken);
    const session = await RefreshSession.findOne({ tokenHash });

    // REUSE DETECTION: If token was already revoked/replaced, attacker may have stolen token!
    if (!session || session.revokedAt) {
      if (session && session.replacedBy) {
        // Invalidate ALL sessions for this user family
        await RefreshSession.updateMany(
          { userId: session.userId, revokedAt: null },
          { revokedAt: new Date() }
        );
        await logAudit({
          req,
          action: 'AUTH_TOKEN_REUSE_DETECTED',
          targetType: 'User',
          targetId: session.userId,
          meta: { reason: 'Attempted reuse of rotated refresh token' }
        });
        res.clearCookie('refreshToken', getRefreshCookieOptions());
        return res.status(401).json({
          success: false,
          data: null,
          error: 'Session revoked due to token reuse detection. Please re-authenticate.'
        });
      }

      res.clearCookie('refreshToken', getRefreshCookieOptions());
      return res.status(401).json({
        success: false,
        data: null,
        error: 'Session invalid or revoked. Please log in again.'
      });
    }

    // Check expiration
    if (session.expiresAt < new Date()) {
      res.clearCookie('refreshToken', getRefreshCookieOptions());
      return res.status(401).json({
        success: false,
        data: null,
        error: 'Session has expired'
      });
    }

    const user = await User.findById(session.userId);
    if (!user || user.status === 'disabled') {
      res.clearCookie('refreshToken', getRefreshCookieOptions());
      return res.status(401).json({
        success: false,
        data: null,
        error: 'User account disabled or not found'
      });
    }

    // ROTATE: Invalidate current token and link replacement
    const newRawRefreshToken = generateRefreshToken();
    const newHash = hashToken(newRawRefreshToken);

    session.revokedAt = new Date();
    session.replacedBy = newHash;
    await session.save();

    await RefreshSession.create({
      userId: user._id,
      tokenHash: newHash,
      userAgent: req.get('user-agent') || '',
      ip: req.ip || '',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });

    const newAccessToken = generateAccessToken(user);
    res.cookie('refreshToken', newRawRefreshToken, getRefreshCookieOptions(true));

    return res.status(200).json({
      success: true,
      data: {
        accessToken: newAccessToken
      },
      error: null
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/logout (Revoke current session)
 */
export async function logout(req, res, next) {
  try {
    const rawToken = req.cookies?.refreshToken || req.body?.refreshToken;

    if (rawToken) {
      const tokenHash = hashToken(rawToken);
      await RefreshSession.updateOne(
        { tokenHash, revokedAt: null },
        { revokedAt: new Date() }
      );
    }

    res.clearCookie('refreshToken', getRefreshCookieOptions());

    if (req.user) {
      await logAudit({
        req,
        action: 'AUTH_LOGOUT',
        targetType: 'User',
        targetId: req.user._id,
        actor: req.user
      });
    }

    return res.status(200).json({
      success: true,
      data: { message: 'Successfully logged out' },
      error: null
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/logout-all (Revoke all active sessions)
 */
export async function logoutAll(req, res, next) {
  try {
    await RefreshSession.updateMany(
      { userId: req.user._id, revokedAt: null },
      { revokedAt: new Date() }
    );

    res.clearCookie('refreshToken', getRefreshCookieOptions());

    await logAudit({
      req,
      action: 'AUTH_LOGOUT_ALL',
      targetType: 'User',
      targetId: req.user._id,
      actor: req.user
    });

    return res.status(200).json({
      success: true,
      data: { message: 'All active sessions have been terminated' },
      error: null
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/auth/me
 */
export async function getMe(req, res) {
  return res.status(200).json({
    success: true,
    data: { user: req.user },
    error: null
  });
}

/**
 * POST /api/auth/change-password
 */
export async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id).select('+passwordHash');
    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Current password is incorrect'
      });
    }

    const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    user.passwordHash = newHash;
    user.mustChangePassword = false;
    await user.save();

    await logAudit({
      req,
      action: 'PASSWORD_CHANGE',
      targetType: 'User',
      targetId: user._id,
      actor: user
    });

    return res.status(200).json({
      success: true,
      data: { message: 'Password updated successfully' },
      error: null
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/forgot-password
 * Never reveals whether the email exists
 */
export async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;
    const genericResponse = {
      success: true,
      data: {
        message: 'If an account with that email exists, password reset instructions have been sent.'
      },
      error: null
    };

    const user = await User.findOne({ email }).select('_id email');
    if (!user) {
      return res.status(200).json(genericResponse);
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);

    await PasswordResetToken.create({
      userId: user._id,
      tokenHash,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000) // 1 hour
    });

    const resetLink = `${env.CLIENT_ORIGIN}/reset-password/${rawToken}?email=${encodeURIComponent(user.email)}`;
    await sendPasswordResetEmail(user.email, resetLink);

    await logAudit({
      req,
      action: 'PASSWORD_RESET_REQUESTED',
      targetType: 'User',
      targetId: user._id,
      meta: { email: user.email }
    });

    return res.status(200).json(genericResponse);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/reset-password
 */
export async function resetPassword(req, res, next) {
  try {
    const { token, email, newPassword } = req.body;

    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Invalid or expired password reset token'
      });
    }

    const tokenHash = hashToken(token);
    const resetDoc = await PasswordResetToken.findOne({
      tokenHash,
      userId: user._id,
      usedAt: null,
      expiresAt: { $gt: new Date() }
    });

    if (!resetDoc) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Invalid or expired password reset token'
      });
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    user.passwordHash = passwordHash;
    user.mustChangePassword = false;
    await user.save();

    resetDoc.usedAt = new Date();
    await resetDoc.save();

    // Revoke all existing sessions for security
    await RefreshSession.updateMany(
      { userId: user._id, revokedAt: null },
      { revokedAt: new Date() }
    );

    await logAudit({
      req,
      action: 'PASSWORD_RESET_COMPLETED',
      targetType: 'User',
      targetId: user._id,
      meta: { email: user.email }
    });

    return res.status(200).json({
      success: true,
      data: { message: 'Password reset successful. Please log in with your new password.' },
      error: null
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/accept-invite (Staff set password)
 */
export async function acceptInvite(req, res, next) {
  try {
    const { token, email, password, name } = req.body;

    const tokenHash = hashToken(token);
    const invitation = await Invitation.findOne({
      tokenHash,
      email: email.toLowerCase(),
      acceptedAt: null,
      expiresAt: { $gt: new Date() }
    });

    if (!invitation) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Invalid or expired invitation token'
      });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    let user = await User.findOne({ email: invitation.email });
    if (user) {
      user.passwordHash = passwordHash;
      user.status = 'active';
      user.mustChangePassword = false;
      if (name) user.name = name;
      await user.save();
    } else {
      user = await User.create({
        name: name || 'Hospital Staff',
        email: invitation.email,
        passwordHash,
        role: invitation.role,
        status: 'active',
        mustChangePassword: false
      });
    }

    invitation.acceptedAt = new Date();
    await invitation.save();

    await logAudit({
      req,
      action: 'INVITATION_ACCEPTED',
      targetType: 'User',
      targetId: user._id,
      meta: { email: user.email, role: user.role }
    });

    return res.status(200).json({
      success: true,
      data: {
        message: 'Invitation accepted. Your account is active.',
        user
      },
      error: null
    });
  } catch (error) {
    next(error);
  }
}

export default {
  register,
  login,
  refresh,
  logout,
  logoutAll,
  getMe,
  changePassword,
  forgotPassword,
  resetPassword,
  acceptInvite
};
