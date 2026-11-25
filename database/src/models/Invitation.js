import mongoose from 'mongoose';

/**
 * @typedef {Object} IInvitation
 * @property {string} email - Email address invited to register
 * @property {'admin'|'doctor'|'patient'} role - Role assigned to new registrant
 * @property {string} tokenHash - Hash of secret invitation link token
 * @property {mongoose.Types.ObjectId} invitedBy - Staff User ID who issued invitation
 * @property {Date} expiresAt - Expiry date (managed by MongoDB TTL)
 * @property {Date|null} [acceptedAt] - Timestamp when invitation was redeemed
 * @property {Date} createdAt - Invitation issuance timestamp
 * @property {Date} updatedAt - Invitation record update timestamp
 */

const invitationSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'Invited email is required'],
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email address']
    },
    role: {
      type: String,
      enum: ['admin', 'doctor', 'patient'],
      default: 'patient',
      required: true
    },
    tokenHash: {
      type: String,
      required: [true, 'Token hash is required'],
      index: true
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Staff inviter reference is required']
    },
    expiresAt: {
      type: Date,
      required: [true, 'Expiration date is required']
    },
    acceptedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// TTL Index for automatic pruning of unaccepted expired invitations
invitationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
invitationSchema.index({ email: 1, acceptedAt: 1 });

export const Invitation = mongoose.model('Invitation', invitationSchema);
export default Invitation;
