import mongoose from 'mongoose';
import { Appointment, User } from '@pulsecare/database';
import { logAudit } from '../middleware/audit.js';
import env from '../config/env.js';
import nodemailer from 'nodemailer';

/**
 * Dispatch 24-hour appointment reminder check
 * Can be called by cron or directly in tests
 */
export async function runAppointmentReminderCheck() {
  const now = new Date();
  const windowStart = new Date(now.getTime() + 23 * 60 * 60 * 1000); // 23h ahead
  const windowEnd = new Date(now.getTime() + 25 * 60 * 60 * 1000);   // 25h ahead

  const upcoming = await Appointment.find({
    scheduledAt: { $gte: windowStart, $lte: windowEnd },
    status: 'scheduled',
    reminderSent: { $ne: true }
  }).populate('patientId', 'name email').populate('doctorId', 'name email');

  let sentCount = 0;

  for (const appt of upcoming) {
    const patientEmail = appt.patientId?.email;
    if (patientEmail) {
      if (env.SMTP_USER && env.SMTP_USER !== 'smtp_user_placeholder') {
        try {
          const transporter = nodemailer.createTransport({
            host: env.SMTP_HOST,
            port: env.SMTP_PORT,
            auth: { user: env.SMTP_USER, pass: env.SMTP_PASS }
          });

          await transporter.sendMail({
            from: env.SMTP_FROM,
            to: patientEmail,
            subject: '[PulseCare Reminder] Clinical Consultation Tomorrow',
            text: `Dear ${appt.patientId.name},\n\nThis is a 24-hour reminder for your scheduled clinical appointment with ${appt.doctorId?.name || 'your clinician'} on ${new Date(appt.scheduledAt).toLocaleString()}.\n\nReason: ${appt.reason || 'General Follow-up'}`
          });
        } catch (e) {
          console.warn('[AppointmentReminder] Email send failed:', e.message);
        }
      } else {
        console.log(`[AppointmentReminder:DevSimulation] 24h reminder dispatched to ${patientEmail} for appointment at ${appt.scheduledAt}`);
      }
    }

    appt.reminderSent = true;
    appt.reminderSentAt = new Date();
    await appt.save();
    sentCount++;
  }

  return { checkedAt: now, sentCount };
}

/**
 * GET /api/appointments
 * List appointments for authenticated user (patient views own, doctor views assigned/ward)
 */
export async function getAppointments(req, res, next) {
  try {
    const query = {};

    if (req.user.role === 'patient') {
      query.patientId = req.user._id;
    } else {
      const { patientId } = req.query;
      if (patientId) {
        if (mongoose.Types.ObjectId.isValid(patientId)) {
          query.patientId = patientId;
        } else {
          const p = await User.findOne({ patientId }).select('_id');
          if (p) query.patientId = p._id;
        }
      }
    }

    const appointments = await Appointment.find(query)
      .populate('patientId', 'patientId name email dob phone')
      .populate('doctorId', 'name email')
      .sort({ scheduledAt: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: { appointments },
      error: null
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/appointments
 * Doctor schedules next patient visit
 */
export async function createAppointment(req, res, next) {
  try {
    const { patientId, scheduledAt, reason, notes } = req.body;

    if (!patientId || !scheduledAt) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'patientId and scheduledAt are required'
      });
    }

    let targetPatient = null;
    if (mongoose.Types.ObjectId.isValid(patientId)) {
      targetPatient = await User.findById(patientId);
    } else {
      targetPatient = await User.findOne({ patientId });
    }

    if (!targetPatient) {
      return res.status(404).json({
        success: false,
        data: null,
        error: `Patient ${patientId} not found`
      });
    }

    const appointment = await Appointment.create({
      patientId: targetPatient._id,
      doctorId: req.user._id,
      scheduledAt: new Date(scheduledAt),
      reason: reason || 'Routine Follow-up',
      notes: notes || '',
      status: 'scheduled',
      reminderSent: false
    });

    await logAudit(req, {
      action: 'APPOINTMENT_SCHEDULE',
      targetType: 'Appointment',
      targetId: appointment._id.toString(),
      meta: { patientId: targetPatient.patientId, scheduledAt }
    });

    return res.status(201).json({
      success: true,
      data: { appointment },
      error: null
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/appointments/:id/cancel
 * Cancel appointment
 */
export async function cancelAppointment(req, res, next) {
  try {
    const { id } = req.params;
    const appointment = await Appointment.findById(id);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'Appointment not found'
      });
    }

    // Patient can only cancel their own appointment
    if (req.user.role === 'patient' && appointment.patientId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        data: null,
        error: 'Access denied: Cannot cancel another patient appointment'
      });
    }

    appointment.status = 'cancelled';
    await appointment.save();

    await logAudit(req, {
      action: 'APPOINTMENT_CANCEL',
      targetType: 'Appointment',
      targetId: appointment._id.toString()
    });

    return res.status(200).json({
      success: true,
      data: { appointment },
      error: null
    });
  } catch (error) {
    next(error);
  }
}
