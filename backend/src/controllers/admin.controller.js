import mongoose from 'mongoose';
import crypto from 'node:crypto';
import {
  User,
  Invitation,
  PasswordResetToken,
  ThresholdProfile,
  AuditEvent,
  MonitoringSession,
  HealthReading
} from '@pulsecare/database';
import { logAudit } from '../middleware/audit.js';
import env from '../config/env.js';
import nodemailer from 'nodemailer';

/**
 * Standard Age-Based Physiological Threshold Reference Templates
 */
export const DEFAULT_AGE_TEMPLATES = {
  neonatal: {
    name: 'Neonatal Profile (0-1 Month)',
    ageGroup: 'neonatal',
    hrMin: 100,
    hrMax: 170,
    spo2Min: 90,
    tempMin: 36.5,
    tempMax: 37.5,
    persistenceSeconds: 5,
    trendRule: { windowMinutes: 10, percentChange: 20 }
  },
  infant: {
    name: 'Infant Profile (1-12 Months)',
    ageGroup: 'infant',
    hrMin: 80,
    hrMax: 140,
    spo2Min: 92,
    tempMin: 36.5,
    tempMax: 37.5,
    persistenceSeconds: 5,
    trendRule: { windowMinutes: 15, percentChange: 20 }
  },
  child: {
    name: 'Child Profile (1-12 Years)',
    ageGroup: 'child',
    hrMin: 70,
    hrMax: 120,
    spo2Min: 92,
    tempMin: 36.0,
    tempMax: 37.8,
    persistenceSeconds: 5,
    trendRule: { windowMinutes: 15, percentChange: 20 }
  },
  adult: {
    name: 'Standard Adult Profile (13-64 Years)',
    ageGroup: 'adult',
    hrMin: 50,
    hrMax: 120,
    spo2Min: 92,
    tempMin: 35.5,
    tempMax: 38.0,
    persistenceSeconds: 5,
    trendRule: { windowMinutes: 15, percentChange: 20 }
  },
  senior: {
    name: 'Senior Geriatric Profile (65+ Years)',
    ageGroup: 'senior',
    hrMin: 50,
    hrMax: 115,
    spo2Min: 90,
    tempMin: 35.0,
    tempMax: 37.8,
    persistenceSeconds: 5,
    trendRule: { windowMinutes: 15, percentChange: 20 }
  }
};

/**
 * Helper to compute age group from DOB
 */
export function getAgeGroupFromDob(dob) {
  if (!dob) return 'adult';
  const birthDate = new Date(dob);
  const now = new Date();
  const ageMonths = (now.getFullYear() - birthDate.getFullYear()) * 12 + (now.getMonth() - birthDate.getMonth());
  const ageYears = ageMonths / 12;

  if (ageMonths < 1) return 'neonatal';
  if (ageMonths <= 12) return 'infant';
  if (ageYears <= 12) return 'child';
  if (ageYears >= 65) return 'senior';
  return 'adult';
}

/**
 * GET /api/admin/users
 * List users with search, role/status filtering, and pagination
 */
export async function listUsers(req, res, next) {
  try {
    const { role, status, search, page = 1, limit = 20 } = req.query;
    const query = {};

    if (role && role !== 'all') {
      query.role = role;
    }

    if (status && status !== 'all') {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { patientId: search.toUpperCase() }
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [users, total] = await Promise.all([
      User.find(query)
        .select('-passwordHash')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      User.countDocuments(query)
    ]);

    return res.status(200).json({
      success: true,
      data: {
        users,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          pages: Math.ceil(total / limitNum) || 1
        }
      },
      error: null
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/admin/invitations
 * Invite a doctor by email with a 48-hour valid invitation link
 */
export async function inviteDoctor(req, res, next) {
  try {
    const { email, role = 'doctor' } = req.body;

    if (!email || !email.includes('@')) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'A valid email address is required for invitation'
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if user already exists
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        data: null,
        error: `User with email ${normalizedEmail} is already registered`
      });
    }

    // Generate secure random 32-byte hex token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const ttlHours = env.INVITATION_TTL_HOURS || 48;
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

    // Save invitation
    await Invitation.create({
      email: normalizedEmail,
      role: role === 'admin' ? 'admin' : 'doctor',
      tokenHash,
      invitedBy: req.user._id,
      expiresAt
    });

    // Create user placeholder with status 'invited'
    await User.create({
      name: `Dr. (${normalizedEmail.split('@')[0]})`,
      email: normalizedEmail,
      passwordHash: 'pending_invitation_activation',
      role: role === 'admin' ? 'admin' : 'doctor',
      status: 'invited',
      mustChangePassword: true
    });

    const inviteUrl = `${env.CLIENT_ORIGIN}/accept-invite?token=${rawToken}&email=${encodeURIComponent(normalizedEmail)}`;

    // Optional email dispatch via nodemailer
    if (env.SMTP_USER && env.SMTP_USER !== 'smtp_user_placeholder') {
      try {
        const transporter = nodemailer.createTransport({
          host: env.SMTP_HOST,
          port: env.SMTP_PORT,
          auth: { user: env.SMTP_USER, pass: env.SMTP_PASS }
        });

        await transporter.sendMail({
          from: env.SMTP_FROM,
          to: normalizedEmail,
          subject: '[PulseCare] Clinician Portal Invitation',
          text: `You have been invited to join the PulseCare Clinical Team as a ${role}.\n\nPlease activate your account within 48 hours using the link below:\n${inviteUrl}`
        });
      } catch (err) {
        console.warn('[Admin] Mail dispatch failed, logged invite URL instead:', err.message);
      }
    } else {
      console.log(`[Admin:InvitationLink] Link for ${normalizedEmail} (valid 48h): ${inviteUrl}`);
    }

    await logAudit(req, {
      action: 'DOCTOR_INVITE',
      targetType: 'Invitation',
      targetId: normalizedEmail,
      meta: { invitedEmail: normalizedEmail, role, expiresAt }
    });

    return res.status(201).json({
      success: true,
      data: {
        email: normalizedEmail,
        role,
        expiresAt,
        inviteUrl
      },
      error: null
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/admin/users/:id/status
 * Enable or disable account. Last admin cannot be disabled!
 */
export async function updateUserStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['active', 'disabled'].includes(status)) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Status must be either active or disabled'
      });
    }

    const targetUser = await User.findById(id);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'User not found'
      });
    }

    // LAST ADMIN PROTECTION: Cannot disable last active admin
    if (targetUser.role === 'admin' && status === 'disabled') {
      const activeAdminsCount = await User.countDocuments({ role: 'admin', status: 'active' });
      if (activeAdminsCount <= 1) {
        return res.status(400).json({
          success: false,
          data: null,
          error: 'Action prohibited: Cannot disable the last active administrator.'
        });
      }
    }

    const previousStatus = targetUser.status;
    targetUser.status = status;
    await targetUser.save();

    await logAudit(req, {
      action: 'USER_STATUS_CHANGE',
      targetType: 'User',
      targetId: targetUser._id.toString(),
      meta: { previousStatus, newStatus: status, userEmail: targetUser.email }
    });

    return res.status(200).json({
      success: true,
      data: {
        user: {
          _id: targetUser._id,
          email: targetUser.email,
          role: targetUser.role,
          status: targetUser.status
        }
      },
      error: null
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/admin/users/:id/force-reset
 * Force password reset on user account (flags mustChangePassword)
 */
export async function forcePasswordReset(req, res, next) {
  try {
    const { id } = req.params;

    const targetUser = await User.findById(id);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'User not found'
      });
    }

    targetUser.mustChangePassword = true;
    await targetUser.save();

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await PasswordResetToken.create({
      userId: targetUser._id,
      tokenHash,
      expiresAt
    });

    const resetLink = `${env.CLIENT_ORIGIN}/reset-password?token=${rawToken}&email=${encodeURIComponent(targetUser.email)}`;

    await logAudit(req, {
      action: 'FORCE_PASSWORD_RESET',
      targetType: 'User',
      targetId: targetUser._id.toString(),
      meta: { userEmail: targetUser.email }
    });

    return res.status(200).json({
      success: true,
      data: {
        message: `Password reset enforced for ${targetUser.email}`,
        mustChangePassword: true,
        resetLink
      },
      error: null
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/admin/users/:id/role
 * Change role. Last admin cannot be demoted!
 */
export async function updateUserRole(req, res, next) {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!['admin', 'doctor', 'patient'].includes(role)) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Invalid role specified'
      });
    }

    const targetUser = await User.findById(id);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'User not found'
      });
    }

    // LAST ADMIN PROTECTION: Cannot demote last admin
    if (targetUser.role === 'admin' && role !== 'admin') {
      const activeAdminsCount = await User.countDocuments({ role: 'admin', status: 'active' });
      if (activeAdminsCount <= 1) {
        return res.status(400).json({
          success: false,
          data: null,
          error: 'Action prohibited: Cannot demote the last remaining administrator.'
        });
      }
    }

    const previousRole = targetUser.role;
    targetUser.role = role;

    // If converted to patient and missing patientId, generate one
    if (role === 'patient' && !targetUser.patientId) {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let code = '';
      const bytes = crypto.randomBytes(6);
      for (let i = 0; i < 6; i++) {
        code += chars[bytes[i] % chars.length];
      }
      targetUser.patientId = `PC-${code}`;
    }

    await targetUser.save();

    await logAudit(req, {
      action: 'ROLE_CHANGE',
      targetType: 'User',
      targetId: targetUser._id.toString(),
      meta: { previousRole, newRole: role, userEmail: targetUser.email }
    });

    return res.status(200).json({
      success: true,
      data: {
        user: {
          _id: targetUser._id,
          email: targetUser.email,
          role: targetUser.role,
          patientId: targetUser.patientId
        }
      },
      error: null
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/admin/threshold-templates
 * Get age-group threshold templates
 */
export async function getThresholdTemplates(req, res, next) {
  try {
    const stored = await ThresholdProfile.find({ scope: 'age-template' }).lean();
    const result = { ...DEFAULT_AGE_TEMPLATES };

    stored.forEach((item) => {
      if (item.ageGroup && result[item.ageGroup]) {
        result[item.ageGroup] = { ...result[item.ageGroup], ...item };
      }
    });

    return res.status(200).json({
      success: true,
      data: { templates: result },
      error: null
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/admin/threshold-templates/:ageGroup
 * Update an age-group physiological threshold template
 */
export async function updateThresholdTemplate(req, res, next) {
  try {
    const { ageGroup } = req.params;
    const { name, hrMin, hrMax, spo2Min, tempMin, tempMax, persistenceSeconds, trendRule } = req.body;

    if (!DEFAULT_AGE_TEMPLATES[ageGroup]) {
      return res.status(400).json({
        success: false,
        data: null,
        error: `Unknown age group: ${ageGroup}`
      });
    }

    const numHrMin = Number(hrMin);
    const numHrMax = Number(hrMax);
    const numTempMin = Number(tempMin);
    const numTempMax = Number(tempMax);
    const numSpo2Min = Number(spo2Min);

    if (numHrMin >= numHrMax) {
      return res.status(400).json({
        success: false,
        data: null,
        error: `Heart rate minimum (${numHrMin}) must be less than maximum (${numHrMax})`
      });
    }

    if (numTempMin >= numTempMax) {
      return res.status(400).json({
        success: false,
        data: null,
        error: `Temperature minimum (${numTempMin}) must be less than maximum (${numTempMax})`
      });
    }

    const template = await ThresholdProfile.findOneAndUpdate(
      { scope: 'age-template', ageGroup },
      {
        name: name || DEFAULT_AGE_TEMPLATES[ageGroup].name,
        scope: 'age-template',
        ageGroup,
        hrMin: numHrMin,
        hrMax: numHrMax,
        spo2Min: numSpo2Min,
        tempMin: numTempMin,
        tempMax: numTempMax,
        persistenceSeconds: Number(persistenceSeconds) || 5,
        trendRule: {
          windowMinutes: Math.max(1, Number(trendRule?.windowMinutes) || 15),
          percentChange: Math.max(1, Number(trendRule?.percentChange) || 20)
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await logAudit(req, {
      action: 'THRESHOLD_TEMPLATE_CHANGE',
      targetType: 'ThresholdProfile',
      targetId: template._id.toString(),
      meta: { ageGroup, hrMin: numHrMin, hrMax: numHrMax, spo2Min: numSpo2Min }
    });

    return res.status(200).json({
      success: true,
      data: { template },
      error: null
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/admin/system/status
 * Health status (DB, storage, SMTP, socket count, data retention)
 */
export async function getSystemStatus(req, res, next) {
  try {
    const dbState = mongoose.connection.readyState;
    const dbStatus = dbState === 1 ? 'connected' : (dbState === 2 ? 'connecting' : 'disconnected');

    const io = req.app.get('io');
    const socketCount = io ? (io.sockets?.sockets?.size || io.engine?.clientsCount || 0) : 0;

    const [usersCount, sessionsCount, readingsCount, alertsCount] = await Promise.all([
      User.countDocuments({}),
      MonitoringSession.countDocuments({}),
      HealthReading.countDocuments({}),
      AuditEvent.countDocuments({})
    ]);

    const uptimeSeconds = Math.floor(process.uptime());
    const memUsage = process.memoryUsage();

    return res.status(200).json({
      success: true,
      data: {
        status: dbState === 1 ? 'healthy' : 'degraded',
        database: {
          status: dbStatus,
          readyState: dbState,
          databaseName: mongoose.connection.name || 'pulsecare'
        },
        telemetryGateway: {
          activeSocketConnections: socketCount,
          protocol: 'WebSocket / WSS'
        },
        storage: {
          provider: 'Local & Cloudinary',
          status: 'ready'
        },
        smtp: {
          host: env.SMTP_HOST,
          port: env.SMTP_PORT,
          status: env.SMTP_USER !== 'smtp_user_placeholder' ? 'configured' : 'dev-simulation'
        },
        dataRetention: {
          rawReadingRetentionDays: env.RAW_READING_RETENTION_DAYS,
          status: 'Automated 24h aggregation active'
        },
        systemStats: {
          totalUsers: usersCount,
          totalSessions: sessionsCount,
          totalTelemetryReadings: readingsCount,
          totalAuditEvents: alertsCount,
          uptimeSeconds,
          memoryMb: Math.round(memUsage.heapUsed / 1024 / 1024)
        },
        backupInstructions: {
          mongodbCommand: `mongodump --uri="${env.MONGODB_URI}" --out=./backup/$(date +%F)`,
          restoreCommand: `mongorestore --uri="${env.MONGODB_URI}" ./backup/<TIMESTAMP>`,
          automatedJob: 'Scheduled daily automated cold backup snapshot.'
        }
      },
      error: null
    });
  } catch (error) {
    next(error);
  }
}
