import mongoose from 'mongoose';
import crypto from 'node:crypto';

/**
 * @typedef {Object} ProfileImage
 * @property {string|null} storageKey - Cloud storage path or ID
 * @property {string|null} mimeType - Media MIME type
 * @property {number|null} size - File size in bytes
 * @property {Date|null} updatedAt - Timestamp of last image update
 */

/**
 * @typedef {Object} EmergencyContact
 * @property {string} [name] - Contact full name
 * @property {string} [phone] - Emergency contact phone number
 * @property {string} [email] - Emergency contact email address
 */

/**
 * @typedef {Object} IUser
 * @property {string} name - Full legal name
 * @property {string} email - Unique email address (lowercase)
 * @property {string} passwordHash - Bcrypt hashed password
 * @property {'admin'|'doctor'|'patient'} role - Clinical access role
 * @property {string} [patientId] - Clinical identifier (format: PC-XXXXXX), unique sparse
 * @property {Date} [dob] - Date of birth
 * @property {string} [phone] - Primary phone number
 * @property {ProfileImage} [profileImage] - Avatar or identification image metadata
 * @property {'active'|'invited'|'disabled'} status - Account lifecycle status
 * @property {boolean} mustChangePassword - Enforce password reset on next login
 * @property {Date} [consentAcceptedAt] - Telemetry & privacy consent acceptance timestamp
 * @property {number} failedLoginCount - Consecutive failed authentication attempts
 * @property {Date|null} [lockUntil] - Account lockout expiration timestamp
 * @property {Date|null} [lastLoginAt] - Timestamp of most recent successful authentication
 * @property {EmergencyContact} [emergencyContact] - Optional next of kin / caregiver details
 * @property {Date} createdAt - Document creation timestamp
 * @property {Date} updatedAt - Document modification timestamp
 */

const profileImageSchema = new mongoose.Schema(
  {
    storageKey: { type: String, default: null },
    mimeType: { type: String, default: null },
    size: { type: Number, default: null },
    updatedAt: { type: Date, default: null }
  },
  { _id: false }
);

const emergencyContactSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, lowercase: true, trim: true }
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'User name is required'],
      trim: true,
      maxlength: [120, 'Name cannot exceed 120 characters']
    },
    email: {
      type: String,
      required: [true, 'Email address is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address']
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required']
    },
    role: {
      type: String,
      enum: {
        values: ['admin', 'doctor', 'patient'],
        message: '{VALUE} is not a valid role'
      },
      default: 'patient',
      index: true
    },
    patientId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      match: [/^PC-[A-Z0-9]{6}$/, 'Patient ID must be in format PC-XXXXXX']
    },
    dob: {
      type: Date
    },
    phone: {
      type: String,
      trim: true
    },
    profileImage: {
      type: profileImageSchema,
      default: () => ({})
    },
    status: {
      type: String,
      enum: ['active', 'invited', 'disabled'],
      default: 'active',
      index: true
    },
    mustChangePassword: {
      type: Boolean,
      default: false
    },
    consentAcceptedAt: {
      type: Date,
      default: null
    },
    failedLoginCount: {
      type: Number,
      default: 0
    },
    lockUntil: {
      type: Date,
      default: null
    },
    lastLoginAt: {
      type: Date,
      default: null
    },
    emergencyContact: {
      type: emergencyContactSchema,
      default: null
    },
    consentWithdrawnAt: {
      type: Date,
      default: null
    },
    deletionRequestedAt: {
      type: Date,
      default: null
    },
    deletionScheduledAt: {
      type: Date,
      default: null
    },
    pushSubscription: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        delete ret.passwordHash;
        delete ret.__v;
        return ret;
      }
    }
  }
);

// Secondary compound index
userSchema.index({ role: 1, status: 1 });

/**
 * Generate a cryptographically secure random alphanumeric string
 * @param {number} length
 * @returns {string}
 */
function generateRandomCode(length = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // exclude ambiguous characters: O, 0, 1, I
  let result = '';
  const randomBytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    result += chars[randomBytes[i] % chars.length];
  }
  return result;
}

/**
 * Generate a unique, non-sequential patientId in format PC-XXXXXX with collision retry
 * @returns {Promise<string>}
 */
userSchema.statics.generateUniquePatientId = async function (maxRetries = 10) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const candidateId = `PC-${generateRandomCode(6)}`;
    const existing = await this.findOne({ patientId: candidateId }).select('_id').lean();
    if (!existing) {
      return candidateId;
    }
  }
  throw new Error('Could not generate unique patient ID after multiple collision attempts');
};

/**
 * Pre-save middleware to assign unique patientId if role is patient and not already set
 */
userSchema.pre('save', async function (next) {
  if (this.role === 'patient' && !this.patientId) {
    try {
      this.patientId = await this.constructor.generateUniquePatientId();
    } catch (err) {
      return next(err);
    }
  }
  next();
});

export const User = mongoose.model('User', userSchema);
export default User;
