import mongoose from 'mongoose';

/**
 * @typedef {Object} TrendRule
 * @property {number} windowMinutes - Time window to evaluate trajectory
 * @property {number} percentChange - Percentage change triggering early warning
 */

/**
 * @typedef {Object} IThresholdProfile
 * @property {string} name - Profile designation (e.g. "Standard Adult ICU Profile")
 * @property {'default'|'patient'} scope - General ward baseline or patient-specific override
 * @property {mongoose.Types.ObjectId|null} [patientId] - Target patient if scope is 'patient'
 * @property {number} hrMin - Heart rate minimum threshold
 * @property {number} hrMax - Heart rate maximum threshold
 * @property {number} spo2Min - Oxygen saturation minimum safe percentage
 * @property {number} tempMin - Core body temperature lower boundary in Celsius
 * @property {number} tempMax - Core body temperature fever boundary in Celsius
 * @property {number} persistenceSeconds - Debounce duration before triggering alarm
 * @property {TrendRule} trendRule - Fast-moving vital trajectory alert parameters
 * @property {Date} createdAt - Record creation timestamp
 * @property {Date} updatedAt - Record modification timestamp
 */

const trendRuleSchema = new mongoose.Schema(
  {
    windowMinutes: {
      type: Number,
      default: 15,
      min: [1, 'Window must be at least 1 minute']
    },
    percentChange: {
      type: Number,
      default: 20,
      min: [1, 'Percent change must be positive']
    }
  },
  { _id: false }
);

const thresholdProfileSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Threshold profile name is required'],
      trim: true
    },
    scope: {
      type: String,
      enum: ['default', 'patient', 'age-template'],
      default: 'default',
      index: true
    },
    ageGroup: {
      type: String,
      enum: ['neonatal', 'infant', 'child', 'adult', 'senior', null],
      default: null,
      index: true
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    hrMin: {
      type: Number,
      default: 50,
      min: [20, 'Heart rate minimum cannot be below 20 bpm']
    },
    hrMax: {
      type: Number,
      default: 120,
      max: [250, 'Heart rate maximum cannot exceed 250 bpm']
    },
    spo2Min: {
      type: Number,
      default: 92,
      min: [50, 'SpO2 minimum cannot be below 50%'],
      max: [100, 'SpO2 cannot exceed 100%']
    },
    tempMin: {
      type: Number,
      default: 35.5,
      min: [30.0, 'Temperature minimum cannot be below 30.0 C']
    },
    tempMax: {
      type: Number,
      default: 38.0,
      max: [45.0, 'Temperature maximum cannot exceed 45.0 C']
    },
    persistenceSeconds: {
      type: Number,
      default: 5,
      min: [0, 'Persistence seconds cannot be negative']
    },
    trendRule: {
      type: trendRuleSchema,
      default: () => ({ windowMinutes: 15, percentChange: 20 })
    }
  },
  {
    timestamps: true
  }
);

// Indexes
thresholdProfileSchema.index({ scope: 1, patientId: 1 });

export const ThresholdProfile = mongoose.model('ThresholdProfile', thresholdProfileSchema);
export default ThresholdProfile;
