import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import {
  connectDB,
  disconnectDB,
  User,
  Device,
  MonitoringSession,
  HealthReading,
  ThresholdProfile,
  Alert
} from '../index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../backend/.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

// ============================================================================
// 1. PRODUCTION GUARD
// ============================================================================
if (process.env.NODE_ENV === 'production') {
  console.error('\n********************************************************************');
  console.error(' [FATAL] SEED SCRIPT REFUSES TO EXECUTE IN PRODUCTION ENVIRONMENT!');
  console.error(' Seeding creates predictable test credentials and synthetic demo data.');
  console.error(' Aborting execution immediately.');
  console.error('********************************************************************\n');
  process.exit(1);
}

// Dev-only default credentials
const SEED_CREDENTIALS = {
  admin: {
    email: process.env.SEED_ADMIN_EMAIL || 'admin@pulsecare.dev',
    password: process.env.SEED_ADMIN_PASSWORD || 'Admin@Pulse#2026',
    role: 'admin',
    name: 'Dr. Sarah Connor (System Admin)'
  },
  doctor: {
    email: process.env.SEED_DOCTOR_EMAIL || 'doctor@pulsecare.dev',
    password: process.env.SEED_DOCTOR_PASSWORD || 'Doctor@Pulse#2026',
    role: 'doctor',
    name: 'Dr. Marcus Vance, MD (Lead Cardiologist)'
  },
  patient: {
    email: process.env.SEED_PATIENT_EMAIL || 'patient@pulsecare.dev',
    password: process.env.SEED_PATIENT_PASSWORD || 'Patient@Pulse#2026',
    role: 'patient',
    name: 'John Doe (Demo Patient 1)'
  }
};

const BCRYPT_ROUNDS = 12;

export async function runSeed() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/pulsecare';
  console.log(`\n======================================================`);
  console.log(` PulseCare Database Seeding Starting...`);
  console.log(` Target URI: ${mongoUri}`);
  console.log(` Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`======================================================\n`);

  await connectDB(mongoUri);

  try {
    // 2. Hash passwords with bcrypt (cost 12)
    console.log('[Seed] Hashing passwords with bcrypt (cost 12)...');
    const adminPasswordHash = await bcrypt.hash(SEED_CREDENTIALS.admin.password, BCRYPT_ROUNDS);
    const doctorPasswordHash = await bcrypt.hash(SEED_CREDENTIALS.doctor.password, BCRYPT_ROUNDS);
    const patientPasswordHash = await bcrypt.hash(SEED_CREDENTIALS.patient.password, BCRYPT_ROUNDS);

    // 3. Upsert Admin User
    console.log('[Seed] Upserting Admin account...');
    const adminUser = await User.findOneAndUpdate(
      { email: SEED_CREDENTIALS.admin.email },
      {
        name: SEED_CREDENTIALS.admin.name,
        email: SEED_CREDENTIALS.admin.email,
        passwordHash: adminPasswordHash,
        role: 'admin',
        status: 'active',
        mustChangePassword: false,
        failedLoginCount: 0,
        lockUntil: null,
        lastLoginAt: null
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // 4. Upsert Doctor User
    console.log('[Seed] Upserting Doctor account...');
    const doctorUser = await User.findOneAndUpdate(
      { email: SEED_CREDENTIALS.doctor.email },
      {
        name: SEED_CREDENTIALS.doctor.name,
        email: SEED_CREDENTIALS.doctor.email,
        passwordHash: doctorPasswordHash,
        role: 'doctor',
        status: 'active',
        mustChangePassword: false,
        failedLoginCount: 0,
        lockUntil: null,
        lastLoginAt: null
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // 5. Upsert 3 Patients with clearly fake names & example.com emails
    console.log('[Seed] Upserting 3 demo patient accounts...');
    const patientsConfig = [
      {
        name: 'John Doe (Demo Patient 1)',
        email: SEED_CREDENTIALS.patient.email,
        patientId: 'PC-DEMO01',
        dob: new Date('1982-04-12'),
        phone: '+1-555-0101',
        emergencyContact: { name: 'Mary Doe', phone: '+1-555-0102', email: 'mary.doe@example.com' }
      },
      {
        name: 'Alice Smith (Demo Patient 2)',
        email: 'alice.smith@example.com',
        patientId: 'PC-DEMO02',
        dob: new Date('1965-09-24'),
        phone: '+1-555-0123',
        emergencyContact: { name: 'Bob Smith', phone: '+1-555-0124', email: 'bob.smith@example.com' }
      },
      {
        name: 'Robert Johnson (Demo Patient 3)',
        email: 'robert.johnson@example.com',
        patientId: 'PC-DEMO03',
        dob: new Date('1994-11-03'),
        phone: '+1-555-0145',
        emergencyContact: { name: 'Clara Johnson', phone: '+1-555-0146', email: 'clara.j@example.com' }
      }
    ];

    const seededPatients = [];
    for (const p of patientsConfig) {
      const patientDoc = await User.findOneAndUpdate(
        { email: p.email },
        {
          name: p.name,
          email: p.email,
          passwordHash: patientPasswordHash,
          role: 'patient',
          patientId: p.patientId,
          dob: p.dob,
          phone: p.phone,
          status: 'active',
          mustChangePassword: false,
          failedLoginCount: 0,
          lockUntil: null,
          consentAcceptedAt: new Date(),
          emergencyContact: p.emergencyContact
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      seededPatients.push(patientDoc);
    }

    const patientOne = seededPatients[0];

    // 6. Upsert 1 default ThresholdProfile
    console.log('[Seed] Upserting default ThresholdProfile...');
    await ThresholdProfile.findOneAndUpdate(
      { scope: 'default', name: 'Standard Adult Ward Thresholds' },
      {
        name: 'Standard Adult Ward Thresholds',
        scope: 'default',
        hrMin: 50,
        hrMax: 120,
        spo2Min: 92,
        tempMin: 35.5,
        tempMax: 38.0,
        persistenceSeconds: 5,
        trendRule: {
          windowMinutes: 15,
          percentChange: 20
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // 7. Upsert 2 Devices: PCD-0001 (active) & PCD-0002 (pending)
    console.log('[Seed] Upserting devices PCD-0001 & PCD-0002...');
    const rawDevOneCredential = 'dev_pcd_0001_raw_secret_token_2026';
    const devOneCredentialHash = await bcrypt.hash(rawDevOneCredential, BCRYPT_ROUNDS);

    const rawDevTwoCredential = 'dev_pcd_0002_raw_secret_token_2026';
    const devTwoCredentialHash = await bcrypt.hash(rawDevTwoCredential, BCRYPT_ROUNDS);

    await Device.findOneAndUpdate(
      { deviceId: 'PCD-0001' },
      {
        deviceId: 'PCD-0001',
        label: 'ICU Bed 1 - Bedside Hub',
        credentialHash: devOneCredentialHash,
        status: 'active',
        firmwareVersion: '1.2.0',
        lastHeartbeatAt: new Date(),
        ipLast: '192.168.1.101',
        createdBy: adminUser._id
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await Device.findOneAndUpdate(
      { deviceId: 'PCD-0002' },
      {
        deviceId: 'PCD-0002',
        label: 'Ward Bed 4 - Mobile Wearable Node',
        credentialHash: devTwoCredentialHash,
        status: 'pending',
        firmwareVersion: '1.0.0',
        lastHeartbeatAt: null,
        ipLast: null,
        createdBy: adminUser._id
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // 8. Create 4 completed sessions for Patient 1 with synthetic readings tagged source: "seed-demo", isDemo: true
    console.log('[Seed] Generating 4 completed sessions with synthetic demo telemetry for Patient 1...');

    // Clean up existing demo sessions/readings for idempotency
    await MonitoringSession.deleteMany({
      patientId: patientOne._id,
      notes: { $regex: /\[DEMO_SESSION/ }
    });
    await HealthReading.deleteMany({
      'meta.patientId': patientOne._id,
      isDemo: true
    });

    const now = Date.now();
    const sessionsConfig = [
      {
        tag: 'DEMO_SESSION_1',
        offsetStartHours: 96,
        durationHours: 6,
        baseHr: 72,
        baseSpo2: 98,
        baseTemp: 36.6,
        notes: '[DEMO_SESSION_1] Routine post-op cardiac stability monitoring.'
      },
      {
        tag: 'DEMO_SESSION_2',
        offsetStartHours: 72,
        durationHours: 6,
        baseHr: 88,
        baseSpo2: 97,
        baseTemp: 37.1,
        notes: '[DEMO_SESSION_2] Elevated heart rate during physical therapy assessment.'
      },
      {
        tag: 'DEMO_SESSION_3',
        offsetStartHours: 48,
        durationHours: 6,
        baseHr: 98,
        baseSpo2: 95,
        baseTemp: 38.2,
        notes: '[DEMO_SESSION_3] Transient fever spike and mild tachycardia episode. Antipyretics administered.'
      },
      {
        tag: 'DEMO_SESSION_4',
        offsetStartHours: 24,
        durationHours: 6,
        baseHr: 74,
        baseSpo2: 99,
        baseTemp: 36.7,
        notes: '[DEMO_SESSION_4] Normalization of vital signs prior to clinical discharge review.'
      }
    ];

    let totalDemoReadings = 0;

    for (let sIdx = 0; sIdx < sessionsConfig.length; sIdx++) {
      const cfg = sessionsConfig[sIdx];
      const startedAt = new Date(now - cfg.offsetStartHours * 3600 * 1000);
      const endedAt = new Date(startedAt.getTime() + cfg.durationHours * 3600 * 1000);
      const sessionId = crypto.randomUUID();

      const session = await MonitoringSession.create({
        sessionId,
        patientId: patientOne._id,
        deviceId: 'PCD-0001',
        startedBy: doctorUser._id,
        startedAt,
        endedAt,
        status: 'completed',
        notes: cfg.notes,
        thresholdSnapshot: {
          hrMin: 50,
          hrMax: 120,
          spo2Min: 92,
          tempMin: 35.5,
          tempMax: 38.0,
          persistenceSeconds: 5
        }
      });

      // Generate 25 sequential synthetic readings per session
      const sampleCount = 25;
      const intervalMs = (cfg.durationHours * 3600 * 1000) / sampleCount;
      const readingsBatch = [];

      for (let i = 0; i < sampleCount; i++) {
        const readingTime = new Date(startedAt.getTime() + i * intervalMs);
        // Small realistic variations
        const hrNoise = (Math.sin(i / 3) * 4) + (Math.random() * 2 - 1);
        const spo2Noise = (Math.random() > 0.8 ? -1 : 0);
        const tempNoise = (Math.cos(i / 4) * 0.2);

        const heartRate = Math.round(cfg.baseHr + hrNoise);
        const spo2 = Math.min(100, Math.max(90, Math.round(cfg.baseSpo2 + spo2Noise)));
        const temperatureC = Math.round((cfg.baseTemp + tempNoise) * 10) / 10;

        readingsBatch.push({
          ts: readingTime,
          meta: {
            patientId: patientOne._id,
            sessionId: session.sessionId,
            deviceId: 'PCD-0001'
          },
          heartRate,
          spo2,
          temperatureC,
          fingerDetected: true,
          signalQuality: Math.floor(92 + Math.random() * 8),
          valid: { hr: true, spo2: true, temp: true },
          seq: i + 1,
          source: 'seed-demo',
          isDemo: true
        });
      }

      await HealthReading.insertMany(readingsBatch);
      totalDemoReadings += readingsBatch.length;
    }

    console.log(`[Seed] Successfully inserted ${totalDemoReadings} synthetic readings across 4 completed sessions.`);

    // 9. Output Table of Credentials and Setup Summary
    console.log('\n========================================================================================');
    console.log(' PULSECARE DATABASE SEEDING COMPLETED SUCCESSFULLY');
    console.log('========================================================================================\n');

    console.table([
      {
        Role: 'Admin',
        Name: SEED_CREDENTIALS.admin.name,
        Email: SEED_CREDENTIALS.admin.email,
        'Default Password': SEED_CREDENTIALS.admin.password,
        MustChangePassword: 'false'
      },
      {
        Role: 'Doctor',
        Name: SEED_CREDENTIALS.doctor.name,
        Email: SEED_CREDENTIALS.doctor.email,
        'Default Password': SEED_CREDENTIALS.doctor.password,
        MustChangePassword: 'false'
      },
      {
        Role: 'Patient 1',
        Name: patientsConfig[0].name,
        Email: patientsConfig[0].email,
        'Default Password': SEED_CREDENTIALS.patient.password,
        MustChangePassword: 'false'
      },
      {
        Role: 'Patient 2',
        Name: patientsConfig[1].name,
        Email: patientsConfig[1].email,
        'Default Password': SEED_CREDENTIALS.patient.password,
        MustChangePassword: 'false'
      },
      {
        Role: 'Patient 3',
        Name: patientsConfig[2].name,
        Email: patientsConfig[2].email,
        'Default Password': SEED_CREDENTIALS.patient.password,
        MustChangePassword: 'false'
      }
    ]);

    console.log('\n--- SEEDED HARDWARE DEVICES ---');
    console.table([
      {
        DeviceID: 'PCD-0001',
        Label: 'ICU Bed 1 - Bedside Hub',
        Status: 'active',
        'One-Time Dev Credential': rawDevOneCredential
      },
      {
        DeviceID: 'PCD-0002',
        Label: 'Ward Bed 4 - Mobile Wearable Node',
        Status: 'pending',
        'One-Time Dev Credential': rawDevTwoCredential
      }
    ]);

    console.log('\n--- SEEDED DATA SUMMARY ---');
    console.log(`- Users:              5 total (1 Admin, 1 Doctor, 3 Patients)`);
    console.log(`- Threshold Profile:  1 default profile ("Standard Adult Ward Thresholds")`);
    console.log(`- Devices:            2 devices (PCD-0001 active, PCD-0002 pending)`);
    console.log(`- Patient 1 Sessions: 4 completed sessions`);
    console.log(`- Synthetic Readings: ${totalDemoReadings} time-series entries (tagged isDemo: true, source: "seed-demo")\n`);

  } catch (error) {
    console.error('\n[Seed Error] Failed during database population:', error);
    throw error;
  } finally {
    await disconnectDB();
  }
}

// Auto-run if executed directly
if (process.argv[1] && (process.argv[1].endsWith('seed.js') || process.argv[1].endsWith('seed'))) {
  runSeed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

export default runSeed;
