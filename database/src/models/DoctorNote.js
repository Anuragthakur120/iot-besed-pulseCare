import mongoose from 'mongoose';

/**
 * @typedef {Object} IDoctorNote
 * @property {mongoose.Types.ObjectId} patientId - Subject patient account reference
 * @property {string|null} [sessionId] - Optional monitoring session context
 * @property {mongoose.Types.ObjectId} authorId - Doctor or clinician authoring note
 * @property {string} text - Clinical observations, diagnosis, or instructions
 * @property {boolean} visibleToPatient - Access visibility toggle for patient portal
 * @property {Date} createdAt - Note timestamp
 * @property {Date} updatedAt - Note edit timestamp
 */

const doctorNoteSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Patient reference is required'],
      index: true
    },
    sessionId: {
      type: String,
      default: null,
      index: true
    },
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Doctor/author reference is required'],
      index: true
    },
    text: {
      type: String,
      required: [true, 'Clinical note text cannot be empty'],
      trim: true
    },
    visibleToPatient: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

// Indexes
doctorNoteSchema.index({ patientId: 1, createdAt: -1 });

export const DoctorNote = mongoose.model('DoctorNote', doctorNoteSchema);
export default DoctorNote;
