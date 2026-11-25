import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import app from '../src/app.js';
import { connectDB, disconnectDB, User, RefreshSession } from '@pulsecare/database';
import { requireRole, requirePatientAccess, requireFreshPassword, authenticate } from '../src/middleware/auth.js';

let mongoServer;

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
});

describe('PulseCare Auth Suite (Module 3)', () => {
  const validPatient = {
    name: 'Jane Patient',
    email: 'jane@example.com',
    password: 'SecurePassword123!',
    dob: '1990-01-01',
    phone: '555-1234',
    consent: true
  };

  it('1. Register: registers patient with PC-XXXXXX patientId and forces patient role', async () => {
    const res = await request(app).post('/api/auth/register').send(validPatient);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.role).toBe('patient');
    expect(res.body.data.user.patientId).toMatch(/^PC-[A-Z0-9]{6}$/);
    expect(res.body.data.accessToken).toBeDefined();

    // Check refresh cookie
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    expect(cookies.some((c) => c.includes('refreshToken='))).toBe(true);
  });

  it('2. Duplicate Email: rejects registration if email already exists', async () => {
    await request(app).post('/api/auth/register').send(validPatient);
    const res = await request(app).post('/api/auth/register').send(validPatient);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('already exists');
  });

  it('3. Weak Password: fails validation on password policy', async () => {
    const weakUser = { ...validPatient, email: 'weak@example.com', password: 'short' };
    const res = await request(app).post('/api/auth/register').send(weakUser);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('4. Login Success & Fail: verifies valid credentials and rejects wrong passwords', async () => {
    await request(app).post('/api/auth/register').send(validPatient);

    // Successful login
    const successRes = await request(app)
      .post('/api/auth/login')
      .send({ email: validPatient.email, password: validPatient.password });

    expect(successRes.status).toBe(200);
    expect(successRes.body.data.accessToken).toBeDefined();

    // Failed login
    const failRes = await request(app)
      .post('/api/auth/login')
      .send({ email: validPatient.email, password: 'WrongPassword123!' });

    expect(failRes.status).toBe(401);
    expect(failRes.body.error).toBe('Invalid email or password');
  });

  it('5. Account Lockout: locks account after 5 consecutive failures', async () => {
    await request(app).post('/api/auth/register').send(validPatient);

    for (let i = 0; i < 4; i++) {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: validPatient.email, password: 'WrongPassword123!' });
      expect(res.status).toBe(401);
    }

    // 5th attempt triggers lockout
    const fifthRes = await request(app)
      .post('/api/auth/login')
      .send({ email: validPatient.email, password: 'WrongPassword123!' });
    expect(fifthRes.status).toBe(423);
    expect(fifthRes.body.error).toContain('Account is temporarily locked');
  });

  it('6. Refresh Rotation & Reuse Detection: rotates token and revokes family on reuse', async () => {
    const regRes = await request(app).post('/api/auth/register').send(validPatient);
    const cookies = regRes.headers['set-cookie'];
    const rawCookie = cookies.find((c) => c.startsWith('refreshToken=')).split(';')[0];

    // 1st Refresh: succeeds and rotates
    const refreshRes1 = await request(app).post('/api/auth/refresh').set('Cookie', [rawCookie]);
    expect(refreshRes1.status).toBe(200);
    expect(refreshRes1.body.data.accessToken).toBeDefined();

    const newCookies = refreshRes1.headers['set-cookie'];
    const newCookie = newCookies.find((c) => c.startsWith('refreshToken=')).split(';')[0];

    // 2nd Refresh with NEW cookie: succeeds
    const refreshRes2 = await request(app).post('/api/auth/refresh').set('Cookie', [newCookie]);
    expect(refreshRes2.status).toBe(200);

    // REUSE ATTACK: Attempt refresh with OLD rotated cookie
    const reuseRes = await request(app).post('/api/auth/refresh').set('Cookie', [rawCookie]);
    expect(reuseRes.status).toBe(401);
    expect(reuseRes.body.error).toContain('token reuse detection');

    // Verify all sessions were invalidated
    const activeSessions = await RefreshSession.countDocuments({ revokedAt: null });
    expect(activeSessions).toBe(0);
  });

  it('7. Logout: revokes session and clears cookie', async () => {
    const regRes = await request(app).post('/api/auth/register').send(validPatient);
    const cookies = regRes.headers['set-cookie'];
    const rawCookie = cookies.find((c) => c.startsWith('refreshToken=')).split(';')[0];

    const logoutRes = await request(app).post('/api/auth/logout').set('Cookie', [rawCookie]);
    expect(logoutRes.status).toBe(200);

    // Subsequent refresh with logged out cookie fails
    const postLogoutRefresh = await request(app).post('/api/auth/refresh').set('Cookie', [rawCookie]);
    expect(postLogoutRefresh.status).toBe(401);
  });

  it('8. Role Checks: patient cannot access doctor-only endpoints', async () => {
    const regRes = await request(app).post('/api/auth/register').send(validPatient);
    const patientToken = regRes.body.data.accessToken;

    const res = await request(app)
      .get('/api/test/doctor-only')
      .set('Authorization', `Bearer ${patientToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('Insufficient permissions');
  });

  it('9. Patient Access Boundary: patient cannot access another patient record', async () => {
    // Register Patient A
    const regA = await request(app).post('/api/auth/register').send(validPatient);
    const tokenA = regA.body.data.accessToken;
    const patientIdA = regA.body.data.user.patientId;

    // Register Patient B
    const patientBData = { ...validPatient, email: 'patientb@example.com' };
    const regB = await request(app).post('/api/auth/register').send(patientBData);
    const patientIdB = regB.body.data.user.patientId;

    // Patient A accesses their own record: succeeds
    const ownRes = await request(app)
      .get(`/api/test/patient-records/${patientIdA}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(ownRes.status).toBe(200);

    // Patient A attempts to access Patient B's record: forbidden
    const unauthorizedRes = await request(app)
      .get(`/api/test/patient-records/${patientIdB}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(unauthorizedRes.status).toBe(403);
    expect(unauthorizedRes.body.error).toContain('Patients can only access their own clinical records');
  });

  it('10. mustChangePassword Gating: blocks access until password is changed', async () => {
    const regRes = await request(app).post('/api/auth/register').send(validPatient);
    const token = regRes.body.data.accessToken;

    // Simulate mustChangePassword flag
    await User.findByIdAndUpdate(regRes.body.data.user._id, { mustChangePassword: true });

    const blockedRes = await request(app)
      .get('/api/test/sensitive-resource')
      .set('Authorization', `Bearer ${token}`);

    expect(blockedRes.status).toBe(403);
    expect(blockedRes.body.code).toBe('MUST_CHANGE_PASSWORD');

    // Change password removes flag
    const changeRes = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({
        currentPassword: validPatient.password,
        newPassword: 'BrandNewPassword999!'
      });

    expect(changeRes.status).toBe(200);

    // Subsequent access allowed
    const allowedRes = await request(app)
      .get('/api/test/sensitive-resource')
      .set('Authorization', `Bearer ${token}`);
    expect(allowedRes.status).toBe(200);
  });
});
