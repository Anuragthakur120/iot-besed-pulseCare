import mongoose from 'mongoose';

/**
 * @typedef {'scheduled'|'in-progress'|'completed'|'cancelled'|'no-show'} AppointmentStatus
 */

/**
 * @typedef {Object} IAppointment
 * @property {mongoose.Types.ObjectId} patientId - Patient attending appointment
 * @property {mongoose.Types.ObjectId} doctorId - Doctor conducting checkup/consultation
 * @property {Date} scheduledAt - Scheduled appointment start time
 * @property {AppointmentStatus} status - Lifecycle state of appointment
 * @property {string} [reason] - Chief complaint or consultation rationale
 * @property {Date} createdAt - Booking creation timestamp
 * @property {Date} updatedAt - Modification timestamp
 */

const appointmentSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Patient reference is required'],
      index: true
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Doctor reference is required'],
      index: true
    },
    scheduledAt: {
      type: Date,
      required: [true, 'Scheduled time is required'],
      index: true
    },
    status: {
      type: String,
      enum: ['scheduled', 'in-progress', 'completed', 'cancelled', 'no-show'],
      default: 'scheduled',
      index: true
    },
    reason: {
      type: String,
      default: '',
      trim: true
    },
    notes: {
      type: String,
      default: '',
      trim: true
    },
    reminderSent: {
      type: Boolean,
      default: false,
      index: true
    },
    reminderSentAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Indexes
appointmentSchema.index({ patientId: 1, scheduledAt: 1 });
appointmentSchema.index({ doctorId: 1, scheduledAt: 1 });
appointmentSchema.index({ status: 1, scheduledAt: 1 });

export const Appointment = mongoose.model('Appointment', appointmentSchema);
export default Appointment;
