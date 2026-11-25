import mongoose from 'mongoose';

/**
 * @typedef {Object} HealthReadingMeta
 * @property {mongoose.Types.ObjectId} patientId - Monitored patient ObjectId
 * @property {string} sessionId - Active monitoring session UUID
 * @property {string} deviceId - Hardware identifier
 */

/**
 * @typedef {Object} HealthReadingValidity
 * @property {boolean} hr - True if heart rate measurement meets signal quality criteria
 * @property {boolean} spo2 - True if pulse oximetry calculation is statistically valid
 * @property {boolean} temp - True if temperature sensor read within calibrated range
 */

/**
 * @typedef {Object} IHealthReading
 * @property {Date} ts - Telemetry sample timestamp (MongoDB timeField)
 * @property {HealthReadingMeta} meta - Dimensional metadata (MongoDB metaField)
 * @property {number|null} heartRate - Beats per minute (null if probe detached, never 0)
 * @property {number|null} spo2 - Oxygen saturation percentage (null if detached, never 0)
 * @property {number|null} temperatureC - Body temperature in Celsius (null if detached, never 0)
 * @property {boolean} fingerDetected - Optical sensor skin contact flag
 * @property {number} signalQuality - PPG signal confidence score (0 to 100)
 * @property {HealthReadingValidity} valid - Per-sensor integrity flags
 * @property {number} seq - Incremental hardware packet sequence counter
 * @property {string} source - Telemetry origin ('device' or 'seed-demo')
 * @property {boolean} [isDemo] - Guard flag ensuring demo/test data never contaminates clinical pipelines
 */

const retentionDays = parseInt(process.env.RAW_READING_RETENTION_DAYS || '0', 10);
const rawRetentionSeconds = retentionDays > 0 ? retentionDays * 86400 : undefined;

const healthReadingSchema = new mongoose.Schema(
  {
    ts: {
      type: Date,
      required: [true, 'Sample timestamp ts is required'],
      default: Date.now
    },
    meta: {
      patientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'meta.patientId is required']
      },
      sessionId: {
        type: String,
        required: [true, 'meta.sessionId is required']
      },
      deviceId: {
        type: String,
        required: [true, 'meta.deviceId is required']
      }
    },
    heartRate: {
      type: Number,
      default: null,
      set: (v) => (v === 0 || v === undefined ? null : v)
    },
    spo2: {
      type: Number,
      default: null,
      min: 0,
      max: 100,
      set: (v) => (v === 0 || v === undefined ? null : v)
    },
    temperatureC: {
      type: Number,
      default: null,
      set: (v) => (v === 0 || v === undefined ? null : v)
    },
    fingerDetected: {
      type: Boolean,
      default: false
    },
    signalQuality: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    valid: {
      hr: { type: Boolean, default: false },
      spo2: { type: Boolean, default: false },
      temp: { type: Boolean, default: false }
    },
    seq: {
      type: Number,
      default: 0
    },
    source: {
      type: String,
      default: 'device'
    },
    isDemo: {
      type: Boolean,
      default: false,
      index: true
    }
  },
  {
    // MongoDB Native Time-Series configuration
    timeseries: {
      timeField: 'ts',
      metaField: 'meta',
      granularity: 'seconds'
    },
    ...(rawRetentionSeconds && { expireAfterSeconds: rawRetentionSeconds })
  }
);

// Indexes
// Secondary index on meta.sessionId + ts for rapid session queries
healthReadingSchema.index({ 'meta.sessionId': 1, ts: -1 });
healthReadingSchema.index({ 'meta.patientId': 1, ts: -1 });
healthReadingSchema.index({ 'meta.deviceId': 1, seq: 1 });

export const HealthReading = mongoose.model('HealthReading', healthReadingSchema);
export default HealthReading;
