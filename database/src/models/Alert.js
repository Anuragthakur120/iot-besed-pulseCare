import mongoose from 'mongoose';

/**
 * @typedef {'HR_HIGH'|'HR_LOW'|'SPO2_LOW'|'TEMP_HIGH'|'TEMP_LOW'|'DEVICE_DISCONNECTED'|'STALE_DATA'|'INVALID_DATA'|'TREND_HR'} AlertType
 */

/**
 * @typedef {'info'|'warning'|'critical'} AlertSeverity
 */

/**
 * @typedef {Object} IAlert
 * @property {mongoose.Types.ObjectId} patientId - Monitored patient
 * @property {string} sessionId - Associated monitoring session UUID
 * @property {string} deviceId - Hardware device generating telemetry
 * @property {AlertType} type - Clinical or hardware fault category
 * @property {AlertSeverity} severity - Urgency classification for clinical response
 * @property {number|string} [value] - Breaching vital value (e.g. SpO2 88)
 * @property {Object|string} [thresholdRef] - Violated threshold definition or rule snapshot
 * @property {Date} triggeredAt - Time condition was detected
 * @property {Date|null} [resolvedAt] - Time condition returned to normal
 * @property {mongoose.Types.ObjectId|null} [acknowledgedBy] - Clinician who silenced/handled alarm
 * @property {Date|null} [acknowledgedAt] - Clinician acknowledgement timestamp
 * @property {Date} createdAt - Record creation timestamp
 * @property {Date} updatedAt - Record modification timestamp
 */

const alertSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Patient reference is required'],
      index: true
    },
    sessionId: {
      type: String,
      required: [true, 'Session ID is required']
    },
    deviceId: {
      type: String,
      required: [true, 'Device ID is required']
    },
    type: {
      type: String,
      enum: [
        'HR_HIGH',
        'HR_LOW',
        'SPO2_LOW',
        'TEMP_HIGH',
        'TEMP_LOW',
        'DEVICE_DISCONNECTED',
        'STALE_DATA',
        'INVALID_DATA',
        'TREND_HR'
      ],
      required: [true, 'Alert type is required']
    },
    severity: {
      type: String,
      enum: ['info', 'warning', 'critical'],
      default: 'warning',
      required: true,
      index: true
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    thresholdRef: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    triggeredAt: {
      type: Date,
      default: Date.now,
      index: true
    },
    resolvedAt: {
      type: Date,
      default: null
    },
    acknowledgedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    acknowledgedAt: {
      type: Date,
      default: null
    },
    note: {
      type: String,
      default: null,
      trim: true
    },
    acknowledgedNote: {
      type: String,
      default: null,
      trim: true
    }
  },
  {
    timestamps: true
  }
);

// Indexes
alertSchema.index({ patientId: 1, triggeredAt: -1 });
alertSchema.index({ patientId: 1, resolvedAt: 1 });
alertSchema.index({ severity: 1, resolvedAt: 1 });

export const Alert = mongoose.model('Alert', alertSchema);
export default Alert;
