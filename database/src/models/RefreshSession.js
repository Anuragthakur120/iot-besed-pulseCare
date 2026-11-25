import mongoose from 'mongoose';

/**
 * @typedef {Object} IRefreshSession
 * @property {mongoose.Types.ObjectId} userId - Reference to User account
 * @property {string} tokenHash - SHA-256 hash of the issued refresh token
 * @property {string} [userAgent] - User agent client string
 * @property {string} [ip] - Remote client IP address
 * @property {Date} expiresAt - Expiration timestamp (managed by MongoDB TTL)
 * @property {Date|null} [revokedAt] - Revocation timestamp if explicitly logged out or invalidated
 * @property {string|null} [replacedBy] - Hash of new token that rotated this session (token reuse detection)
 * @property {Date} createdAt - Session issuance timestamp
 * @property {Date} updatedAt - Session update timestamp
 */

const refreshSessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true
    },
    tokenHash: {
      type: String,
      required: [true, 'Token hash is required'],
      index: true
    },
    userAgent: {
      type: String,
      default: ''
    },
    ip: {
      type: String,
      default: ''
    },
    expiresAt: {
      type: Date,
      required: [true, 'Session expiration date is required']
    },
    revokedAt: {
      type: Date,
      default: null
    },
    replacedBy: {
      type: String,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// TTL Index: Document automatically removed when expiresAt timestamp is reached
refreshSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
refreshSessionSchema.index({ userId: 1, revokedAt: 1 });

export const RefreshSession = mongoose.model('RefreshSession', refreshSessionSchema);
export default RefreshSession;
