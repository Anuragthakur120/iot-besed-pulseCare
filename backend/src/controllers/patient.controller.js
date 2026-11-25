import fs from 'node:fs';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { User, DoctorNote, Invitation } from '@pulsecare/database';
import { logAudit } from '../middleware/audit.js';
import {
  processAndStoreProfilePhoto,
  deleteProfilePhoto,
  generateSignedPhotoUrl,
  verifySignedPhotoUrl,
  getPhotoFilePath
} from '../utils/photoStorage.js';
import { sendPasswordResetEmail } from '../utils/mailer.js';
import env from '../config/env.js';

/**
 * GET /api/patients
 * Doctor/Admin list with search, filter, pagination
 */
export async function getPatients(req, res, next) {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const search = req.query.search ? req.query.search.trim() : '';
    const status = req.query.status;
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

    const query = { role: 'patient' };

    if (status) {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { patientId: { $regex: search, $options: 'i' } }
      ];
    }

    const total = await User.countDocuments(query);
    const patients = await User.find(query)
      .sort({ [sortBy]: sortOrder })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    // Attach signed photo URLs if profileImage exists
    const enrichedPatients = patients.map((p) => ({
      ...p,
      photoUrl: p.profileImage?.storageKey
        ? generateSignedPhotoUrl(p.patientId, p.profileImage.storageKey)
        : null
    }));

    return res.status(200).json({
      success: true,
      data: {
        patients: enrichedPatients,
        pagination: {
          total,
          page,
          pages: Math.ceil(total / limit) || 1,
          limit
        }
      },
      error: null
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/patients
 * Doctor/Admin registers a new patient, generates patientId, sends invite
 */
export async function createPatient(req, res, next) {
  try {
    const { name, email, dob, phone, emergencyContact } = req.body;

    const existingUser = await User.findOne({ email }).select('_id');
    if (existingUser) {
      return res.status(409).json({
        success: false,
        data: null,
        error: 'An account with this email address already exists'
      });
    }

    // Temporary random secret password
    const tempPassword = `Temp@Pulse#${crypto.randomBytes(4).toString('hex')}A1!`;
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    const newPatient = await User.create({
      name,
      email,
      passwordHash,
      role: 'patient',
      dob,
      phone: phone || '',
      emergencyContact: emergencyContact || null,
      status: 'invited',
      mustChangePassword: true
    });

    // Create Invitation Token
    const rawInviteToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawInviteToken).digest('hex');

    await Invitation.create({
      email: newPatient.email,
      role: 'patient',
      tokenHash,
      invitedBy: req.user._id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });

    const inviteLink = `${env.CLIENT_ORIGIN}/accept-invite/${rawInviteToken}?email=${encodeURIComponent(newPatient.email)}`;
    await sendPasswordResetEmail(newPatient.email, inviteLink);

    await logAudit({
      req,
      action: 'PATIENT_CREATE',
      targetType: 'User',
      targetId: newPatient._id,
      meta: { patientId: newPatient.patientId, email: newPatient.email },
      actor: req.user
    });

    return res.status(201).json({
      success: true,
      data: {
        patient: newPatient,
        message: 'Patient registered and onboarding email dispatched.'
      },
      error: null
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/patients/:patientId
 * Patient reads own; Doctor/Admin reads any (audited!)
 */
export async function getPatientById(req, res, next) {
  try {
    const { patientId } = req.params;

    const patient = await User.findOne({ patientId, role: 'patient' }).lean();
    if (!patient) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'Patient record not found'
      });
    }

    // Log clinical audit whenever a doctor/admin accesses a patient chart
    if (['doctor', 'admin'].includes(req.user.role)) {
      await logAudit({
        req,
        action: 'PATIENT_CHART_READ',
        targetType: 'User',
        targetId: patient._id,
        meta: { patientId: patient.patientId },
        actor: req.user
      });
    }

    const photoUrl = patient.profileImage?.storageKey
      ? generateSignedPhotoUrl(patient.patientId, patient.profileImage.storageKey)
      : null;

    return res.status(200).json({
      success: true,
      data: {
        patient: {
          ...patient,
          photoUrl
        }
      },
      error: null
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/patients/:patientId
 */
export async function updatePatient(req, res, next) {
  try {
    const { patientId } = req.params;
    const updates = req.body;

    const patient = await User.findOne({ patientId, role: 'patient' });
    if (!patient) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'Patient record not found'
      });
    }

    const isStaff = ['doctor', 'admin'].includes(req.user.role);

    if (isStaff) {
      if (updates.name) patient.name = updates.name;
      if (updates.dob) patient.dob = updates.dob;
      if (updates.status) patient.status = updates.status;
    }

    if (updates.phone !== undefined) patient.phone = updates.phone;
    if (updates.emergencyContact) patient.emergencyContact = updates.emergencyContact;

    await patient.save();

    await logAudit({
      req,
      action: 'PATIENT_UPDATE',
      targetType: 'User',
      targetId: patient._id,
      meta: { patientId: patient.patientId },
      actor: req.user
    });

    return res.status(200).json({
      success: true,
      data: { patient },
      error: null
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/patients/:patientId/photo
 */
export async function uploadPatientPhoto(req, res, next) {
  try {
    const { patientId } = req.params;

    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'No photo file provided'
      });
    }

    const patient = await User.findOne({ patientId, role: 'patient' });
    if (!patient) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'Patient record not found'
      });
    }

    // Delete existing photo if present
    if (patient.profileImage?.storageKey) {
      await deleteProfilePhoto(patient.profileImage.storageKey);
    }

    // Magic bytes check + sharp resize + strip EXIF
    const stored = await processAndStoreProfilePhoto(req.file.buffer);

    patient.profileImage = {
      storageKey: stored.storageKey,
      mimeType: stored.mimeType,
      size: stored.size,
      updatedAt: new Date()
    };
    await patient.save();

    const photoUrl = generateSignedPhotoUrl(patient.patientId, stored.storageKey);

    await logAudit({
      req,
      action: 'PATIENT_PHOTO_UPLOAD',
      targetType: 'User',
      targetId: patient._id,
      meta: { patientId: patient.patientId, storageKey: stored.storageKey },
      actor: req.user
    });

    return res.status(200).json({
      success: true,
      data: {
        photoUrl,
        profileImage: patient.profileImage
      },
      error: null
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      data: null,
      error: error.message
    });
  }
}

/**
 * DELETE /api/patients/:patientId/photo
 */
export async function deletePatientPhotoController(req, res, next) {
  try {
    const { patientId } = req.params;

    const patient = await User.findOne({ patientId, role: 'patient' });
    if (!patient) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'Patient record not found'
      });
    }

    if (patient.profileImage?.storageKey) {
      await deleteProfilePhoto(patient.profileImage.storageKey);
      patient.profileImage = {
        storageKey: null,
        mimeType: null,
        size: null,
        updatedAt: new Date()
      };
      await patient.save();
    }

    return res.status(200).json({
      success: true,
      data: { message: 'Photo deleted successfully' },
      error: null
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/patients/:patientId/photo
 * Serves photo if signed URL is valid or user is authenticated
 */
export async function getPatientPhoto(req, res, next) {
  try {
    const { patientId } = req.params;
    const { key, exp, sig } = req.query;

    const isSignedValid = key && exp && sig && verifySignedPhotoUrl(patientId, key, exp, sig);

    if (!isSignedValid && !req.user) {
      return res.status(401).json({
        success: false,
        data: null,
        error: 'Unauthorized access to photo. Valid signature required.'
      });
    }

    const patient = await User.findOne({ patientId, role: 'patient' });
    if (!patient || !patient.profileImage?.storageKey) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'Photo not found'
      });
    }

    const filePath = getPhotoFilePath(key || patient.profileImage.storageKey);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'Photo file missing on storage'
      });
    }

    res.setHeader('Content-Type', patient.profileImage.mimeType || 'image/webp');
    res.setHeader('Cache-Control', 'public, max-age=300');
    fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/patients/:patientId/notes
 */
export async function getPatientNotes(req, res, next) {
  try {
    const { patientId } = req.params;

    const patient = await User.findOne({ patientId, role: 'patient' }).select('_id');
    if (!patient) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'Patient record not found'
      });
    }

    const isPatient = req.user.role === 'patient';
    const query = { patientId: patient._id };

    // Patients only see notes marked visibleToPatient
    if (isPatient) {
      query.visibleToPatient = true;
    }

    const notes = await DoctorNote.find(query)
      .populate('authorId', 'name role')
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: { notes },
      error: null
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/patients/:patientId/notes
 * Doctor writes clinical chart note
 */
export async function createPatientNote(req, res, next) {
  try {
    const { patientId } = req.params;
    const { text, sessionId, visibleToPatient = true } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Note content cannot be empty'
      });
    }

    const patient = await User.findOne({ patientId, role: 'patient' }).select('_id');
    if (!patient) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'Patient record not found'
      });
    }

    const note = await DoctorNote.create({
      patientId: patient._id,
      sessionId: sessionId || null,
      authorId: req.user._id,
      text: text.trim(),
      visibleToPatient: Boolean(visibleToPatient)
    });

    await note.populate('authorId', 'name role');

    await logAudit({
      req,
      action: 'DOCTOR_NOTE_CREATED',
      targetType: 'DoctorNote',
      targetId: note._id,
      meta: { patientId, visibleToPatient },
      actor: req.user
    });

    return res.status(201).json({
      success: true,
      data: { note },
      error: null
    });
  } catch (error) {
    next(error);
  }
}

export default {
  getPatients,
  createPatient,
  getPatientById,
  updatePatient,
  uploadPatientPhoto,
  deletePatientPhotoController,
  getPatientPhoto,
  getPatientNotes,
  createPatientNote
};
