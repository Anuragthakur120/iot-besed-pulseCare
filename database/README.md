# @pulsecare/database

Mongoose 8 schema definitions, time-series data modeling, connection lifecycle management, and database seed scripts for the PulseCare IoT Patient Telemetry & Monitoring System.

---

## 1. Schema Architecture & Collections

| # | Collection / Model | Description | Primary Indexes & Key Constraints |
|---|---|---|---|
| 1 | **`User`** | Staff (Admin, Doctor) and Patient profiles | `email` (unique), `patientId` (unique sparse, format `PC-XXXXXX`), `{role: 1, status: 1}` |
| 2 | **`RefreshSession`** | Refresh token sessions for JWT rotation | `tokenHash`, `userId`, `expiresAt` (TTL auto-purge index) |
| 3 | **`PasswordResetToken`**| Time-limited password reset tokens | `tokenHash`, `userId`, `expiresAt` (TTL index) |
| 4 | **`Invitation`** | Role onboarding invitations | `email`, `tokenHash`, `expiresAt` (TTL index) |
| 5 | **`Device`** | Physical bedside/wearable ESP32 nodes | `deviceId` (unique, e.g. `PCD-0001`), `{status: 1, lastHeartbeatAt: -1}` |
| 6 | **`MonitoringSession`**| Clinical telemetry tracking sessions | `sessionId` (unique UUID), `{patientId: 1, startedAt: -1}` |
| 7 | **`HealthReading`** | **MongoDB Time-Series Collection** | `timeField: 'ts'`, `metaField: 'meta'`, `{ 'meta.sessionId': 1, ts: -1 }`, retention TTL via `RAW_READING_RETENTION_DAYS` |
| 8 | **`Alert`** | Clinical alarms & NEWS2 threshold breaches | `{patientId: 1, triggeredAt: -1}`, `{severity: 1, resolvedAt: 1}` |
| 9 | **`ThresholdProfile`** | Vitals alarm thresholds & trend rules | `{scope: 1, patientId: 1}` |
| 10| **`DoctorNote`** | Clinician patient chart notes | `{patientId: 1, createdAt: -1}` |
| 11| **`Appointment`** | Clinical consultations & ward rounds | `{patientId: 1, scheduledAt: 1}`, `{doctorId: 1, scheduledAt: 1}` |
| 12| **`AuditEvent`** | Immutable clinical & security audit log | `{at: -1}`, `{actorId: 1, targetId: 1, at: -1}`, automatic secret sanitization |

---

## 2. Time-Series Collection: `HealthReading`

The `HealthReading` model leverages MongoDB's native **Time-Series Engine** designed specifically for high-frequency IoT sensors:
- **`timeField`**: `ts` (ISODate timestamp of telemetry packet)
- **`metaField`**: `meta` object containing `{ patientId, sessionId, deviceId }`
- **Granularity**: `seconds`
- **Data Integrity**: Missing values are stored explicitly as `null`, never `0` (so a disconnected sensor is never misinterpreted as cardiac arrest / zero pulse).
- **Retention**: Configured via `RAW_READING_RETENTION_DAYS` in your environment (e.g. 30 days).

---

## 3. Database Seeding

The seed script is **strictly blocked** in production (`NODE_ENV === 'production'`). It creates demo credentials hashed with bcrypt (cost 12), sets `mustChangePassword = true`, and populates 4 completed sessions with realistic telemetry for Patient 1.

### Running Seed Script:
```bash
# From monorepo root:
npm run seed

# Or inside database folder:
cd database
npm run seed
```

### Dev-Only Seed Accounts:
- **Admin**: `admin@pulsecare.dev` / `Admin@Pulse#2026`
- **Doctor**: `doctor@pulsecare.dev` / `Doctor@Pulse#2026`
- **Patient**: `patient@pulsecare.dev` / `Patient@Pulse#2026`
- **Hardware Device PCD-0001 Secret**: `dev_pcd_0001_raw_secret_token_2026`

---

## 4. Backup & Restore Scripts

MongoDB Database Tools wrappers (`mongodump` & `mongorestore`):

```bash
# Backup to database/backups/backup_YYYYMMDD_HHMMSS
node src/scripts/backup.js

# Restore from latest backup:
node src/scripts/restore.js

# Restore from specific backup directory:
node src/scripts/restore.js ./backups/backup_2026-10-25T15-00-00-000Z
```

---

## 5. MongoDB Atlas Cloud Setup Guide

To deploy with MongoDB Atlas:
1. Log in to [MongoDB Atlas](https://cloud.mongodb.com/).
2. Create an **M0 (Free)** or **M10 Dedicated** cluster in your preferred AWS/GCP region.
3. Under **Security > Network Access**, click **Add IP Address** and add your server's public IP (or `0.0.0.0/0` with secure credentials during initial dev).
4. Under **Security > Database Access**, create a user (e.g. `pulsecare_app`) with read/write access to the `pulsecare` database.
5. Under **Clusters > Connect**, select **Drivers** (Node.js) and copy the connection string:
   ```env
   MONGODB_URI=mongodb+srv://pulsecare_app:<password>@cluster0.abcde.mongodb.net/pulsecare?retryWrites=true&w=majority
   ```
6. Paste the URI into `backend/.env` and run `npm run seed` to verify cloud connectivity.
