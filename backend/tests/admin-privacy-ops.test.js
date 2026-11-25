import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app.js';
import {
  User,
  Invitation,
  Appointment,
  HealthReading,
  ThresholdProfile,
  AuditEvent
} from '@pulsecare/database';
import { generateAccessToken } from '../src/utils/tokens.js';
import { runAppointmentReminderCheck } from '../src/controllers/appointment.controller.js';
import { runDataRetentionRollup } from '../src/jobs/dataRetention.js';
import { getAgeGroupFromDob } from '../src/controllers/admin.controller.js';

let mongoServer;
let adminToken, doctorToken, patientToken;
let adminUser, doctorUser, patientUser;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  adminUser = await User.create({
    name: 'Primary Admin',
    email: 'admin.m9@pulsecare.dev',
    passwordHash: 'hashed_pw',
    role: 'admin',
    status: 'active'
  });

  doctorUser = await User.create({
    name: 'Dr. Sarah Cardiologist',
    email: 'doctor.m9@pulsecare.dev',
    passwordHash: 'hashed_pw',
    role: 'doctor',
    status: 'active'
  });

  patientUser = await User.create({
    name: 'Patient Bob',
    email: 'bob.m9@pulsecare.dev',
    passwordHash: 'hashed_pw',
    role: 'patient',
    patientId: 'PC-BOB001',
    status: 'active'
  });

  adminToken = generateAccessToken(adminUser);
  doctorToken = generateAccessToken(doctorUser);
  patientToken = generateAccessToken(patientUser);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await Invitation.deleteMany({});
  await Appointment.deleteMany({});
  await HealthReading.deleteMany({});
});

describe('PulseCare Module 9 & 10 Suite: Admin, Governance, Ops & Privacy', () => {

  // -------------------------------------------------------------
  // 1. Admin-Only Access Gating
  // -------------------------------------------------------------
  it('1. Admin Access: rejects non-admin users with 403 Forbidden', async () => {
    // Doctor attempts to access admin users endpoint
    const docRes = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${doctorToken}`);

    expect(docRes.status).toBe(403);
    expect(docRes.body.error).toMatch(/Access denied/i);

    // Patient attempts to access admin users endpoint
    const patRes = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${patientToken}`);

    expect(patRes.status).toBe(403);

    // Admin can access -> 200 OK
    const adminRes = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(adminRes.status).toBe(200);
    expect(adminRes.body.success).toBe(true);
    expect(adminRes.body.data.users).toBeDefined();
  });

  // -------------------------------------------------------------
  // 2. Last-Admin Protection
  // -------------------------------------------------------------
  it('2. Last-Admin Protection: cannot disable or demote the last remaining active admin', async () => {
    // Attempt to disable the single active admin
    const disableRes = await request(app)
      .patch(`/api/admin/users/${adminUser._id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'disabled' });

    expect(disableRes.status).toBe(400);
    expect(disableRes.body.error).toMatch(/Cannot disable the last active administrator/i);

    // Attempt to demote the single active admin to doctor
    const demoteRes = await request(app)
      .patch(`/api/admin/users/${adminUser._id}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'doctor' });

    expect(demoteRes.status).toBe(400);
    expect(demoteRes.body.error).toMatch(/Cannot demote the last remaining administrator/i);
  });

  // -------------------------------------------------------------
  // 3. Invitation Creation and 48-Hour Expiry
  // -------------------------------------------------------------
  it('3. Doctor Invitation: creates 48-hour token and blocks expired invitations', async () => {
    const inviteRes = await request(app)
      .post('/api/admin/invitations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: 'newdoc@hospital.dev', role: 'doctor' });

    expect(inviteRes.status).toBe(201);
    expect(inviteRes.body.success).toBe(true);
    expect(inviteRes.body.data.inviteUrl).toContain('/accept-invite?token=');

    const inv = await Invitation.findOne({ email: 'newdoc@hospital.dev' });
    expect(inv).toBeDefined();
    expect(inv.role).toBe('doctor');

    // Verify 48-hour expiration calculation
    const ttlMs = new Date(inv.expiresAt).getTime() - Date.now();
    expect(ttlMs).toBeGreaterThan(47 * 60 * 60 * 1000);
    expect(ttlMs).toBeLessThanOrEqual(48 * 60 * 60 * 1000);

    // Verify accepting with expired invitation is rejected by auth controller
    inv.expiresAt = new Date(Date.now() - 1000); // artificially expire
    await inv.save();

    const acceptRes = await request(app)
      .post('/api/auth/accept-invite')
      .send({
        token: 'any_raw_token_that_is_expired',
        email: 'newdoc@hospital.dev',
        password: 'ValidPassword123!'
      });

    expect(acceptRes.status).toBe(400);
  });

  // -------------------------------------------------------------
  // 4. Appointment 24-Hour Reminder Job
  // -------------------------------------------------------------
  it('4. Appointment Scheduler: 24h reminder check detects upcoming appointments and marks reminderSent', async () => {
    const now = new Date();
    // Appointment scheduled in exactly 24 hours
    const appt24h = await Appointment.create({
      patientId: patientUser._id,
      doctorId: doctorUser._id,
      scheduledAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      reason: 'Post-op Cardiac Holter Review',
      status: 'scheduled',
      reminderSent: false
    });

    // Appointment scheduled in 5 days (should NOT trigger reminder)
    const appt5d = await Appointment.create({
      patientId: patientUser._id,
      doctorId: doctorUser._id,
      scheduledAt: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000),
      reason: 'Annual Checkup',
      status: 'scheduled',
      reminderSent: false
    });

    // Run appointment reminder worker
    const checkResult = await runAppointmentReminderCheck();
    expect(checkResult.sentCount).toBe(1);

    const updated24h = await Appointment.findById(appt24h._id);
    expect(updated24h.reminderSent).toBe(true);
    expect(updated24h.reminderSentAt).toBeDefined();

    const updated5d = await Appointment.findById(appt5d._id);
    expect(updated5d.reminderSent).toBe(false);
  });

  // -------------------------------------------------------------
  // 5. Account Deletion with 7-Day Cooling Period & Cancel
  // -------------------------------------------------------------
  it('5. Account Deletion: initiates 7-day cooling period and supports cancellation', async () => {
    // Request deletion
    const reqRes = await request(app)
      .post('/api/privacy/delete-request')
      .set('Authorization', `Bearer ${patientToken}`);

    expect(reqRes.status).toBe(200);
    expect(reqRes.body.data.coolingPeriodDays).toBe(7);

    let updatedPatient = await User.findById(patientUser._id);
    expect(updatedPatient.status).toBe('disabled');
    expect(updatedPatient.deletionScheduledAt).toBeDefined();

    // Cancel deletion request
    const cancelRes = await request(app)
      .post('/api/privacy/cancel-delete')
      .set('Authorization', `Bearer ${patientToken}`);

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.status).toBe('active');

    updatedPatient = await User.findById(patientUser._id);
    expect(updatedPatient.status).toBe('active');
    expect(updatedPatient.deletionScheduledAt).toBeNull();
  });

  // -------------------------------------------------------------
  // 6. Data Retention & Rollup Job
  // -------------------------------------------------------------
  it('6. Data Retention Rollup: purges raw telemetry samples older than retention window', async () => {
    const oldDate = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000); // 40 days old
    const freshDate = new Date(); // now

    // Old readings (40 days old)
    await HealthReading.create({
      ts: oldDate,
      meta: { sessionId: 'sess-old-01', patientId: patientUser._id, deviceId: 'PCD-0001' },
      heartRate: 72,
      spo2: 98,
      temperatureC: 36.8,
      seq: 901
    });

    // Fresh reading (now)
    await HealthReading.create({
      ts: freshDate,
      meta: { sessionId: 'sess-fresh-01', patientId: patientUser._id, deviceId: 'PCD-0001' },
      heartRate: 75,
      spo2: 99,
      temperatureC: 36.9,
      seq: 902
    });

    // Run retention rollup with 30-day threshold
    const retentionResult = await runDataRetentionRollup(30);
    expect(retentionResult.deletedCount).toBe(1);

    const remainingReadings = await HealthReading.find({});
    expect(remainingReadings.length).toBe(1);
    expect(remainingReadings[0].seq).toBe(902);
  });

  // -------------------------------------------------------------
  // 7. Age Group Template Resolution
  // -------------------------------------------------------------
  it('7. Clinical Reference: resolves correct physiological age group from DOB', () => {
    const now = new Date();

    // Infant: 6 months old
    const infantDob = new Date(now.getFullYear(), now.getMonth() - 6, 1);
    expect(getAgeGroupFromDob(infantDob)).toBe('infant');

    // Child: 8 years old
    const childDob = new Date(now.getFullYear() - 8, 1, 1);
    expect(getAgeGroupFromDob(childDob)).toBe('child');

    // Senior: 72 years old
    const seniorDob = new Date(now.getFullYear() - 72, 1, 1);
    expect(getAgeGroupFromDob(seniorDob)).toBe('senior');

    // Adult: 35 years old
    const adultDob = new Date(now.getFullYear() - 35, 1, 1);
    expect(getAgeGroupFromDob(adultDob)).toBe('adult');
  });

  // -------------------------------------------------------------
  // 8. System Status & Readiness Check
  // -------------------------------------------------------------
  it('8. Observability: /api/health and /api/ready probe endpoints', async () => {
    const healthRes = await request(app).get('/api/health');
    expect(healthRes.status).toBe(200);
    expect(healthRes.body.status).toBe('ok');
    expect(healthRes.body.db).toBe('connected');

    const readyRes = await request(app).get('/api/ready/ready');
    expect(readyRes.status).toBe(200);
    expect(readyRes.body.status).toBe('ready');
  });
});
