import mongoose from 'mongoose';

/**
 * @typedef {Object} IAuditEvent
 * @property {mongoose.Types.ObjectId|null} [actorId] - User or service triggering action
 * @property {string} actorRole - Role of the actor ('admin'|'doctor'|'patient'|'device'|'system')
 * @property {string} action - Event code (e.g. 'AUTH_LOGIN', 'SESSION_START', 'ALERT_ACKNOWLEDGE')
 * @property {string} targetType - Affected entity category (e.g. 'User', 'MonitoringSession', 'Device')
 * @property {string} [targetId] - Primary identifier of affected entity
 * @property {string} [ip] - Originating IP address
 * @property {string} [userAgent] - Client HTTP User-Agent
 * @property {Object} [meta] - Contextual metadata sanitized of secrets/tokens
 * @property {Date} at - Event timestamp
 */

/**
 * Deep sanitization function to strip sensitive fields from metadata
 * @param {any} obj
 * @returns {any}
 */
function sanitizeMeta(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeMeta);

  const sensitiveKeys = [
    'password',
    'passwordhash',
    'token',
    'tokenhash',
    'refreshtoken',
    'secret',
    'pairingcode',
    'credential',
    'credentialhash',
    'authorization'
  ];

  const cleaned = {};
  for (const [key, val] of Object.entries(obj)) {
    if (sensitiveKeys.includes(key.toLowerCase())) {
      cleaned[key] = '[REDACTED]';
    } else if (val && typeof val === 'object') {
      cleaned[key] = sanitizeMeta(val);
    } else {
      cleaned[key] = val;
    }
  }
  return cleaned;
}

const auditEventSchema = new mongoose.Schema(
  {
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    actorRole: {
      type: String,
      default: 'system',
      trim: true
    },
    action: {
      type: String,
      required: [true, 'Audit action is required'],
      trim: true,
      index: true
    },
    targetType: {
      type: String,
      required: [true, 'Target type is required'],
      trim: true
    },
    targetId: {
      type: String,
      default: null,
      index: true
    },
    ip: {
      type: String,
      default: ''
    },
    userAgent: {
      type: String,
      default: ''
    },
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
      set: (val) => sanitizeMeta(val)
    },
    at: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    timestamps: false
  }
);

// Indexes
auditEventSchema.index({ at: -1 });
auditEventSchema.index({ actorId: 1, targetId: 1, at: -1 });
auditEventSchema.index({ targetType: 1, targetId: 1 });

export const AuditEvent = mongoose.model('AuditEvent', auditEventSchema);
export default AuditEvent;
