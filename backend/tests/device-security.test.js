import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import app from '../src/app.js';
import {
  connectDB,
  disconnectDB,
  User,
  Device,
  MonitoringSession,
  HealthReading
} from '@pulsecare/database';
import { generateAccessToken } from '../src/utils/tokens.js';
import { calculateDeviceHmac } from '../src/utils/crypto.js';

let mongoServer;
let adminToken;
let doctorToken;
let adminUser;
let doctorUser;
let patientUser;

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

  // Admin user
  adminUser = await User.create({
    name: 'Admin User',
    email: 'admin@pulsecare.dev',
    passwordHash: await bcrypt.hash('Admin@Pulse#2026', 10),
    role: 'admin',
    status: 'active'
  });
  adminToken = generateAccessToken(adminUser);

  // Doctor user
  doctorUser = await User.create({
    name: 'Dr. Sarah Connor',
    email: 'doctor@pulsecare.dev',
    passwordHash: await bcrypt.hash('Doctor@Pulse#2026', 10),
    role: 'doctor',
    status: 'active'
  });
  doctorToken = generateAccessToken(doctorUser);

  // Patient user
  patientUser = await User.create({
    name: 'John Patient',
    email: 'patient@pulsecare.dev',
    passwordHash: await bcrypt.hash('Patient@Pulse#2026', 10),
    role: 'patient',
    patientId: 'PC-PAT001',
    status: 'active'
  });
});

describe('PulseCare Module 7: Device API & Cryptographic Security Suite', () => {
  it('1. Create Device: Admin generates device with a 15-minute one-time pairing code', async () => {
    const res = await request(app)
      .post('/api/devices')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ label: 'ICU Bed 5 Bedside Node' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.deviceId).toMatch(/^PCD-/);
    expect(res.body.data.pairingCode).toBeDefined();
    expect(res.body.data.pairingCode).toMatch(/^[0-9]{6}$/);

    const device = await Device.findOne({ deviceId: res.body.data.deviceId });
    expect(device.status).toBe('pending');
    expect(device.pairingCodeHash).toBeDefined();
  });

  it('2. Device Pair Flow: exchanges pairing code for 64-char hex deviceKey; invalidates pairing code', async () => {
    // 1. Admin creates device
    const createRes = await request(app)
      .post('/api/devices')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ label: 'Ward 2 Bedside Hub' });

    const { deviceId, pairingCode } = createRes.body.data;

    // 2. Hardware node pairs with code
    const pairRes = await request(app)
      .post('/api/device/pair')
      .send({ deviceId, pairingCode });

    expect(pairRes.status).toBe(200);
    expect(pairRes.body.success).toBe(true);
    expect(pairRes.body.data.deviceKey).toBeDefined();
    expect(pairRes.body.data.deviceKey.length).toBe(64); // 32 bytes hex

    // 3. Pairing code must now be invalidated
    const device = await Device.findOne({ deviceId });
    expect(device.status).toBe('active');
    expect(device.pairingCodeHash).toBeNull();
    expect(device.pairingExpiresAt).toBeNull();
    expect(device.encryptedKey).toBeDefined();

    // 4. Re-using pairing code must fail
    const replayPairRes = await request(app)
      .post('/api/device/pair')
      .send({ deviceId, pairingCode });

    expect(replayPairRes.status).toBe(400);
  });

  it('3. HMAC-SHA256 Authentication: accepts valid signature and updates heartbeat', async () => {
    // Register and pair
    const createRes = await request(app)
      .post('/api/devices')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ deviceId: 'PCD-0010', label: 'ICU Node 10' });

    const pairRes = await request(app)
      .post('/api/device/pair')
      .send({ deviceId: 'PCD-0010', pairingCode: createRes.body.data.pairingCode });

    const deviceKey = pairRes.body.data.deviceKey;

    // Construct HMAC request
    const path = '/api/device/heartbeat';
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = 'nonce_hb_test_01';
    const body = { firmwareVersion: '1.3.0', rssi: -65, uptime: 120, freeHeap: 180000 };
    const signature = calculateDeviceHmac(deviceKey, 'POST', path, timestamp, nonce, body);

    const hbRes = await request(app)
      .post(path)
      .set('x-device-id', 'PCD-0010')
      .set('x-timestamp', timestamp)
      .set('x-nonce', nonce)
      .set('x-signature', signature)
      .send(body);

    expect(hbRes.status).toBe(200);
    expect(hbRes.body.success).toBe(true);
    expect(hbRes.body.data.status).toBe('LIVE');

    const updatedDev = await Device.findOne({ deviceId: 'PCD-0010' });
    expect(updatedDev.rssi).toBe(-65);
    expect(updatedDev.freeHeap).toBe(180000);
  });

  it('4. Clock Skew Protection: rejects request when timestamp differs by > 60 seconds', async () => {
    const createRes = await request(app)
      .post('/api/devices')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ deviceId: 'PCD-0011', label: 'Node 11' });

    const pairRes = await request(app)
      .post('/api/device/pair')
      .send({ deviceId: 'PCD-0011', pairingCode: createRes.body.data.pairingCode });

    const deviceKey = pairRes.body.data.deviceKey;

    // Send timestamp from 120 seconds in the past
    const path = '/api/device/heartbeat';
    const expiredTimestamp = (Math.floor(Date.now() / 1000) - 120).toString();
    const nonce = 'nonce_expired_clock_01';
    const body = { firmwareVersion: '1.3.0' };
    const signature = calculateDeviceHmac(deviceKey, 'POST', path, expiredTimestamp, nonce, body);

    const res = await request(app)
      .post(path)
      .set('x-device-id', 'PCD-0011')
      .set('x-timestamp', expiredTimestamp)
      .set('x-nonce', nonce)
      .set('x-signature', signature)
      .send(body);

    expect(res.status).toBe(401);
    expect(res.body.error).toContain('clock drift exceeds 60 seconds');
  });

  it('5. Replay Attack Prevention: rejects duplicate nonce within validity window', async () => {
    const createRes = await request(app)
      .post('/api/devices')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ deviceId: 'PCD-0012', label: 'Node 12' });

    const pairRes = await request(app)
      .post('/api/device/pair')
      .send({ deviceId: 'PCD-0012', pairingCode: createRes.body.data.pairingCode });

    const deviceKey = pairRes.body.data.deviceKey;

    const path = '/api/device/heartbeat';
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const reusedNonce = 'replay_nonce_unique_999';
    const body = { firmwareVersion: '1.3.0' };
    const signature = calculateDeviceHmac(deviceKey, 'POST', path, timestamp, reusedNonce, body);

    // First request -> OK
    const res1 = await request(app)
      .post(path)
      .set('x-device-id', 'PCD-0012')
      .set('x-timestamp', timestamp)
      .set('x-nonce', reusedNonce)
      .set('x-signature', signature)
      .send(body);
    expect(res1.status).toBe(200);

    // Replayed request with same nonce -> 401 Replay Attack
    const res2 = await request(app)
      .post(path)
      .set('x-device-id', 'PCD-0012')
      .set('x-timestamp', timestamp)
      .set('x-nonce', reusedNonce)
      .set('x-signature', signature)
      .send(body);

    expect(res2.status).toBe(401);
    expect(res2.body.error).toContain('Replay attack detected');
  });

  it('6. Revocation: instantly blocks revoked device from communicating', async () => {
    const createRes = await request(app)
      .post('/api/devices')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ deviceId: 'PCD-0013', label: 'Node 13' });

    const pairRes = await request(app)
      .post('/api/device/pair')
      .send({ deviceId: 'PCD-0013', pairingCode: createRes.body.data.pairingCode });

    const deviceKey = pairRes.body.data.deviceKey;

    // Admin revokes device
    const revokeRes = await request(app)
      .post('/api/devices/PCD-0013/revoke')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(revokeRes.status).toBe(200);
    expect(revokeRes.body.data.status).toBe('revoked');

    // Attempting signed request from revoked device must return 403
    const path = '/api/device/heartbeat';
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = 'nonce_revoked_test_01';
    const body = { firmwareVersion: '1.3.0' };
    const signature = calculateDeviceHmac(deviceKey, 'POST', path, timestamp, nonce, body);

    const res = await request(app)
      .post(path)
      .set('x-device-id', 'PCD-0013')
      .set('x-timestamp', timestamp)
      .set('x-nonce', nonce)
      .set('x-signature', signature)
      .send(body);

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('revoked');
  });

  it('7. Telemetry Ingest: returns 409 no_active_session when device is not assigned to a session', async () => {
    const createRes = await request(app)
      .post('/api/devices')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ deviceId: 'PCD-0014', label: 'Node 14' });

    const pairRes = await request(app)
      .post('/api/device/pair')
      .send({ deviceId: 'PCD-0014', pairingCode: createRes.body.data.pairingCode });

    const deviceKey = pairRes.body.data.deviceKey;

    const path = '/api/device/readings';
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = 'nonce_readings_unassigned_01';
    const body = { seq: 1, hr: 75, spo2: 98, tempC: 36.8, fingerDetected: true, signalQuality: 92 };
    const signature = calculateDeviceHmac(deviceKey, 'POST', path, timestamp, nonce, body);

    const res = await request(app)
      .post(path)
      .set('x-device-id', 'PCD-0014')
      .set('x-timestamp', timestamp)
      .set('x-nonce', nonce)
      .set('x-signature', signature)
      .send(body);

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('no_active_session');
  });

  it('8. Offline Batch Ingestion & De-duplication: ingests batch array when active session exists', async () => {
    // 1. Create and pair device
    const createRes = await request(app)
      .post('/api/devices')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ deviceId: 'PCD-0015', label: 'Node 15' });

    const pairRes = await request(app)
      .post('/api/device/pair')
      .send({ deviceId: 'PCD-0015', pairingCode: createRes.body.data.pairingCode });

    const deviceKey = pairRes.body.data.deviceKey;

    // 2. Doctor assigns device to patient in an active session
    await request(app)
      .post('/api/sessions')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        patientId: 'PC-PAT001',
        deviceId: 'PCD-0015',
        notes: 'Clinical Telemetry Test'
      });

    // 3. Device posts batch of offline buffered readings (including a duplicate seq)
    const batch = [
      { seq: 101, hr: 72, spo2: 98, tempC: 36.9, fingerDetected: true, signalQuality: 95 },
      { seq: 102, hr: 74, spo2: 97, tempC: 37.0, fingerDetected: true, signalQuality: 94 },
      { seq: 102, hr: 74, spo2: 97, tempC: 37.0, fingerDetected: true, signalQuality: 94 } // Duplicate!
    ];

    const path = '/api/device/readings';
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = 'nonce_batch_replay_01';
    const signature = calculateDeviceHmac(deviceKey, 'POST', path, timestamp, nonce, batch);

    const res = await request(app)
      .post(path)
      .set('x-device-id', 'PCD-0015')
      .set('x-timestamp', timestamp)
      .set('x-nonce', nonce)
      .set('x-signature', signature)
      .send(batch);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.processed).toBe(2); // Only 2 unique samples processed

    const count = await HealthReading.countDocuments({ 'meta.deviceId': 'PCD-0015' });
    expect(count).toBe(2);
  });

  it('9. Remote Config: returns sample interval, heartbeat interval, and buzzer thresholds', async () => {
    const createRes = await request(app)
      .post('/api/devices')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ deviceId: 'PCD-0016', label: 'Node 16' });

    const pairRes = await request(app)
      .post('/api/device/pair')
      .send({ deviceId: 'PCD-0016', pairingCode: createRes.body.data.pairingCode });

    const deviceKey = pairRes.body.data.deviceKey;

    const path = '/api/device/config';
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = 'nonce_config_get_01';
    const signature = calculateDeviceHmac(deviceKey, 'GET', path, timestamp, nonce, '');

    const res = await request(app)
      .get(path)
      .set('x-device-id', 'PCD-0016')
      .set('x-timestamp', timestamp)
      .set('x-nonce', nonce)
      .set('x-signature', signature);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.sampleIntervalMs).toBe(1000);
    expect(res.body.data.heartbeatIntervalMs).toBe(10000);
    expect(res.body.data.thresholds.hrMin).toBe(50);
    expect(res.body.data.thresholds.spo2Min).toBe(92);
  });
});
