import mongoose from 'mongoose';

/**
 * @typedef {Object} IPasswordResetToken
 * @property {mongoose.Types.ObjectId} userId - Reference to User account
 * @property {string} tokenHash - Cryptographic hash of password reset token
 * @property {Date} expiresAt - Expiration timestamp (managed by MongoDB TTL)
 * @property {Date|null} [usedAt] - Timestamp when token was consumed
 * @property {Date} createdAt - Generation timestamp
 * @property {Date} updatedAt - Modification timestamp
 */

const passwordResetTokenSchema = new mongoose.Schema(
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
    expiresAt: {
      type: Date,
      required: [true, 'Expiration date is required']
    },
    usedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// TTL Index for auto-cleanup of expired reset tokens
passwordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const PasswordResetToken = mongoose.model('PasswordResetToken', passwordResetTokenSchema);
export default PasswordResetToken;
