import mongoose from 'mongoose';
import crypto from 'node:crypto';

/**
 * @typedef {Object} ThresholdSnapshot
 * @property {number} [hrMin] - Heart rate lower threshold
 * @property {number} [hrMax] - Heart rate upper threshold
 * @property {number} [spo2Min] - SpO2 lower threshold percentage
 * @property {number} [tempMin] - Body temperature lower limit Celsius
 * @property {number} [tempMax] - Body temperature upper limit Celsius
 * @property {number} [persistenceSeconds] - Debounce interval before alert fires
 */

/**
 * @typedef {Object} IMonitoringSession
 * @property {string} sessionId - Unique UUID identifying this clinical session
 * @property {mongoose.Types.ObjectId} patientId - Patient being monitored
 * @property {string} deviceId - Physical node bound to session
 * @property {mongoose.Types.ObjectId} startedBy - Clinician who attached sensor / initiated monitoring
 * @property {Date} startedAt - Session start time
 * @property {Date|null} [endedAt] - Session conclusion time
 * @property {'active'|'completed'|'aborted'} status - Current session progress
 * @property {string} [notes] - Clinical handover notes or admission remarks
 * @property {ThresholdSnapshot} [thresholdSnapshot] - Point-in-time copy of alarm criteria
 * @property {Date} createdAt - Record creation timestamp
 * @property {Date} updatedAt - Record modification timestamp
 */

const monitoringSessionSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: [true, 'Session ID is required'],
      unique: true,
      default: () => crypto.randomUUID()
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Patient reference is required'],
      index: true
    },
    deviceId: {
      type: String,
      required: [true, 'Device ID is required'],
      index: true
    },
    startedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Staff initiator reference is required']
    },
    startedAt: {
      type: Date,
      default: Date.now,
      index: true
    },
    endedAt: {
      type: Date,
      default: null
    },
    status: {
      type: String,
      enum: ['active', 'completed', 'aborted'],
      default: 'active',
      index: true
    },
    notes: {
      type: String,
      default: '',
      trim: true
    },
    thresholdSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({
        hrMin: 50,
        hrMax: 120,
        spo2Min: 92,
        tempMin: 35.5,
        tempMax: 38.0,
        persistenceSeconds: 5
      })
    }
  },
  {
    timestamps: true
  }
);

// Secondary compound indexes
monitoringSessionSchema.index({ patientId: 1, startedAt: -1 });
monitoringSessionSchema.index({ deviceId: 1, status: 1 });

export const MonitoringSession = mongoose.model('MonitoringSession', monitoringSessionSchema);
export default MonitoringSession;
