import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import app from '../src/app.js';
import {
  connectDB,
  disconnectDB,
  User,
  Device,
  MonitoringSession,
  HealthReading,
  Alert
} from '@pulsecare/database';
import { generateAccessToken } from '../src/utils/tokens.js';

let mongoServer;
let doctorToken;
let patientToken;
let patientTwoToken;
let doctorUser;
let patientUser;
let patientTwoUser;
const RAW_DEVICE_KEY = 'dev_pcd_0001_raw_secret_token_2026';

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await connectDB(uri);
});

afterAll(async () => {
  await disconnectDB();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

beforeEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }

  // Seed Doctor
  doctorUser = await User.create({
    name: 'Dr. Sarah Connor',
    email: 'dr.connor@pulsecare.dev',
    passwordHash: await bcrypt.hash('Doctor@Pulse#2026', 10),
    role: 'doctor',
    status: 'active'
  });
  doctorToken = generateAccessToken(doctorUser);

  // Seed Patient 1
  patientUser = await User.create({
    name: 'John Patient',
    email: 'john@pulsecare.dev',
    passwordHash: await bcrypt.hash('Patient@Pulse#2026', 10),
    role: 'patient',
    patientId: 'PC-PAT001',
    status: 'active'
  });
  patientToken = generateAccessToken(patientUser);

  // Seed Patient 2
  patientTwoUser = await User.create({
    name: 'Alice Patient',
    email: 'alice@pulsecare.dev',
    passwordHash: await bcrypt.hash('Patient@Pulse#2026', 10),
    role: 'patient',
    patientId: 'PC-PAT002',
    status: 'active'
  });
  patientTwoToken = generateAccessToken(patientTwoUser);

  // Seed Device PCD-0001
  const credentialHash = await bcrypt.hash(RAW_DEVICE_KEY, 10);
  await Device.create({
    deviceId: 'PCD-0001',
    label: 'Ward Bed 1 Node',
    credentialHash,
    status: 'active',
    lastHeartbeatAt: new Date()
  });
});

describe('PulseCare Modules 5 & 6 Telemetry Suite', () => {
  it('1. Session Start: Doctor initiates session pairing patient and device', async () => {
    const res = await request(app)
      .post('/api/sessions')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        patientId: 'PC-PAT001',
        deviceId: 'PCD-0001',
        notes: 'Post-op observation'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.session.sessionId).toBeDefined();
    expect(typeof res.body.data.session.sessionId).toBe('string');
    expect(res.body.data.session.status).toBe('active');
    expect(res.body.data.session.thresholdSnapshot).toBeDefined();

    // Verify Device record updated
    const device = await Device.findOne({ deviceId: 'PCD-0001' });
    expect(device.currentSessionId).toBe(res.body.data.session.sessionId);
  });

  it('2. Double-booking prevention: rejects if device is already active in another session', async () => {
    // Start first session
    await request(app)
      .post('/api/sessions')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        patientId: 'PC-PAT001',
        deviceId: 'PCD-0001'
      });

    // Attempt second session on same device
    const res = await request(app)
      .post('/api/sessions')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        patientId: 'PC-PAT002',
        deviceId: 'PCD-0001'
      });

    expect(res.status).toBe(409);
    expect(res.body.error).toContain('already in use');
  });

  it('3. Telemetry Ingest: hardware posts telemetry sample, evaluates thresholds and alerts', async () => {
    // Start session first
    const sessionRes = await request(app)
      .post('/api/sessions')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        patientId: 'PC-PAT001',
        deviceId: 'PCD-0001'
      });
    const sessionId = sessionRes.body.data.session.sessionId;

    // Send valid telemetry sample with low SpO2 (88% triggers SPO2_LOW)
    const ingestRes = await request(app)
      .post('/api/devices/ingest')
      .set('x-device-id', 'PCD-0001')
      .set('x-device-key', RAW_DEVICE_KEY)
      .send({
        heartRate: 78,
        spo2: 88, // Below min limit (92%)
        temperatureC: 37.1,
        fingerDetected: true,
        signalQuality: 95,
        seq: 1
      });

    expect(ingestRes.status).toBe(201);
    expect(ingestRes.body.success).toBe(true);
    expect(ingestRes.body.data.alertsTriggered).toBeGreaterThanOrEqual(1);

    // Verify HealthReading persisted
    const reading = await HealthReading.findOne({ 'meta.sessionId': sessionId });
    expect(reading).toBeDefined();
    expect(reading.heartRate).toBe(78);
    expect(reading.spo2).toBe(88);
    expect(reading.temperatureC).toBe(37.1);

    // Verify Alert persisted
    const alert = await Alert.findOne({ sessionId, type: 'SPO2_LOW' });
    expect(alert).toBeDefined();
    expect(alert.value).toBe(88);
    expect(alert.severity).toBe('critical'); // 88 < 90 is critical
  });

  it('4. Sensor Invariant: probe detached records null for vitals, never 0', async () => {
    await request(app)
      .post('/api/sessions')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        patientId: 'PC-PAT001',
        deviceId: 'PCD-0001'
      });

    const res = await request(app)
      .post('/api/devices/ingest')
      .set('x-device-id', 'PCD-0001')
      .set('x-device-key', RAW_DEVICE_KEY)
      .send({
        heartRate: 0,
        spo2: 0,
        temperatureC: 36.8,
        fingerDetected: false,
        signalQuality: 0,
        seq: 2
      });

    expect(res.status).toBe(201);
    const reading = await HealthReading.findOne({ seq: 2 });
    expect(reading.heartRate).toBeNull();
    expect(reading.spo2).toBeNull();
    expect(reading.temperatureC).toBe(36.8);
  });

  it('5. Session Stop: clinician stops session and releases device', async () => {
    const sessionRes = await request(app)
      .post('/api/sessions')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        patientId: 'PC-PAT001',
        deviceId: 'PCD-0001'
      });
    const sessionId = sessionRes.body.data.session.sessionId;

    const stopRes = await request(app)
      .post(`/api/sessions/${sessionId}/stop`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({ notes: 'Patient discharged' });

    expect(stopRes.status).toBe(200);
    expect(stopRes.body.data.session.status).toBe('completed');
    expect(stopRes.body.data.session.endedAt).toBeDefined();

    // Device currentSessionId must be null
    const device = await Device.findOne({ deviceId: 'PCD-0001' });
    expect(device.currentSessionId).toBeNull();
  });

  it('6. Patient Isolation: patient cannot access another patient record', async () => {
    // Patient 1 tries to access Patient 2 record
    const res = await request(app)
      .get('/api/patients/PC-PAT002')
      .set('Authorization', `Bearer ${patientToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('Access denied');
  });

  it('7. Patient can access their own record and read visible notes', async () => {
    const res = await request(app)
      .get('/api/patients/PC-PAT001')
      .set('Authorization', `Bearer ${patientToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.patient.patientId).toBe('PC-PAT001');
  });

  it('8. Session Comparison: computes mathematical deltas without subjective interpretations', async () => {
    // Create two completed sessions with sample readings
    const s1 = await MonitoringSession.create({
      patientId: patientUser._id,
      deviceId: 'PCD-0001',
      startedBy: doctorUser._id,
      status: 'completed',
      startedAt: new Date(Date.now() - 7200000),
      endedAt: new Date(Date.now() - 3600000)
    });

    const s2 = await MonitoringSession.create({
      patientId: patientUser._id,
      deviceId: 'PCD-0001',
      startedBy: doctorUser._id,
      status: 'completed',
      startedAt: new Date(Date.now() - 3500000),
      endedAt: new Date()
    });

    // Add readings
    await HealthReading.create({
      ts: new Date(),
      meta: { patientId: patientUser._id, sessionId: s1.sessionId, deviceId: 'PCD-0001' },
      heartRate: 70,
      spo2: 98,
      temperatureC: 36.5
    });

    await HealthReading.create({
      ts: new Date(),
      meta: { patientId: patientUser._id, sessionId: s2.sessionId, deviceId: 'PCD-0001' },
      heartRate: 80,
      spo2: 96,
      temperatureC: 37.0
    });

    const res = await request(app)
      .get(`/api/sessions/compare?a=${s1.sessionId}&b=${s2.sessionId}`)
      .set('Authorization', `Bearer ${doctorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.difference.heartRateAvgDelta).toBe(10); // 80 - 70
    expect(res.body.data.difference.spo2AvgDelta).toBe(-2); // 96 - 98
    expect(res.body.data.difference.temperatureCAvgDelta).toBe(0.5); // 37.0 - 36.5
    expect(res.body.data.dataQualityWarnings.length).toBeGreaterThan(0);
    // Ensure no subjective clinical text like "improved" or "worsened"
    const text = JSON.stringify(res.body.data).toLowerCase();
    expect(text).not.toContain('improved');
    expect(text).not.toContain('worsened');
  });
});
