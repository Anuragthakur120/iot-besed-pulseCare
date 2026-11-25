import mongoose from 'mongoose';

/**
 * @typedef {Object} IDevice
 * @property {string} deviceId - Unique hardware device code (e.g. PCD-0001)
 * @property {string} [label] - Human readable room or ward label
 * @property {string} credentialHash - Cryptographic hash of device authentication secret
 * @property {'pending'|'active'|'revoked'} status - Lifecycle authorization state
 * @property {string|null} [pairingCodeHash] - Hash of temporary Bluetooth/WiFi pairing code
 * @property {Date|null} [pairingExpiresAt] - Pairing code validity deadline
 * @property {Date|null} [lastHeartbeatAt] - Last recorded telemetry ping
 * @property {string} firmwareVersion - Current onboard firmware semver
 * @property {string|null} [ipLast] - Last recorded LAN/WAN IP of device
 * @property {string|null} [currentSessionId] - Active MonitoringSession UUID
 * @property {mongoose.Types.ObjectId} [createdBy] - Staff member who registered the device
 * @property {Date} createdAt - Registration timestamp
 * @property {Date} updatedAt - Device record update timestamp
 */

const deviceSchema = new mongoose.Schema(
  {
    deviceId: {
      type: String,
      required: [true, 'Device ID is required'],
      unique: true,
      trim: true,
      uppercase: true,
      match: [/^PCD-[0-9A-Z]{4,8}$/, 'Device ID must follow PCD-XXXX format']
    },
    label: {
      type: String,
      trim: true,
      default: 'Bedside Node'
    },
    credentialHash: {
      type: String,
      default: null
    },
    encryptedKey: {
      type: String,
      default: null
    },
    status: {
      type: String,
      enum: ['pending', 'active', 'revoked'],
      default: 'pending',
      index: true
    },
    pairingCodeHash: {
      type: String,
      default: null
    },
    pairingExpiresAt: {
      type: Date,
      default: null
    },
    lastHeartbeatAt: {
      type: Date,
      default: null
    },
    firmwareVersion: {
      type: String,
      default: '1.0.0'
    },
    ipLast: {
      type: String,
      default: null
    },
    rssi: {
      type: Number,
      default: null
    },
    uptime: {
      type: Number,
      default: null
    },
    freeHeap: {
      type: Number,
      default: null
    },
    currentSessionId: {
      type: String,
      default: null
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Secondary compound index
deviceSchema.index({ status: 1, lastHeartbeatAt: -1 });

export const Device = mongoose.model('Device', deviceSchema);
export default Device;
