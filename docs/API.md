# PulseCare REST API & WebSocket Specification

PulseCare provides an enterprise clinical REST API adhering to uniform JSON response payloads `{ success: boolean, data: any, error: string | null }`, strict HTTP status codes, and WebSocket channels for sub-second telemetry delivery.

Interactive OpenAPI 3.0 documentation is available in real time at:
`http://localhost:5000/api/docs`

---

## 1. Global Standards & Headers

### Common Request Headers
| Header | Description | Required For |
| :--- | :--- | :--- |
| `Authorization` | `Bearer <JWT_ACCESS_TOKEN>` | Protected REST endpoints |
| `Content-Type` | `application/json` (or `multipart/form-data`) | All POST/PUT/PATCH requests |
| `X-Device-Id` | Unique Hardware Bedside ID (e.g. `PCD-0001`) | Device Ingestion Endpoints |
| `X-Timestamp` | Unix timestamp in seconds | Device Ingestion Endpoints |
| `X-Nonce` | 32-character random hexadecimal nonce | Device Ingestion Endpoints |
| `X-Signature` | HMAC-SHA256 signature calculated with deviceKey | Device Ingestion Endpoints |

### Standard Response Envelope
```json
{
  "success": true,
  "data": { ... },
  "error": null
}
```

---

## 2. Authentication API (`/api/auth`)

### `POST /api/auth/register`
- **Role Requirement**: Public (forced to role: `"patient"`).
- **Request Body**:
  ```json
  {
    "name": "Jane Doe",
    "email": "jane.doe@example.com",
    "password": "SecurePassword123!",
    "dob": "1988-06-15",
    "phone": "+15551234567",
    "consent": true
  }
  ```
- **Response (201 Created)**: Returns user object with generated `patientId` (e.g. `PC-481920`).
- **Errors**: `400 Bad Request` (Zod validation), `409 Conflict` (Email already registered).

### `POST /api/auth/login`
- **Role Requirement**: Public.
- **Request Body**:
  ```json
  {
    "email": "doctor@pulsecare.dev",
    "password": "Password@123",
    "rememberMe": true
  }
  ```
- **Response (200 OK)**:
  - Sets signed `HttpOnly` refresh token cookie (`refreshToken`).
  - Response body returns `{ user, accessToken }` (valid for 15 minutes).
- **Errors**: `401 Unauthorized` (Invalid credentials), `423 Locked` (5 consecutive failures lock account for 15 min).

### `POST /api/auth/refresh`
- **Role Requirement**: Authenticated via Cookie or Body (`refreshToken`).
- **Response (200 OK)**: Rotates refresh token in cookie and database; returns new `{ accessToken }`.
- **Errors**: `401 Unauthorized` (Invalid or revoked token family).

### `POST /api/auth/logout`
- **Role Requirement**: Authenticated.
- **Response (200 OK)**: Revokes current refresh token session and clears cookie.

### `POST /api/auth/logout-all`
- **Role Requirement**: Authenticated.
- **Response (200 OK)**: Revokes all active refresh token sessions across all devices for current user.

### `GET /api/auth/me`
- **Role Requirement**: Authenticated (`Bearer <token>`).
- **Response (200 OK)**: Current authenticated profile, role, and temporary password flags.

### `POST /api/auth/change-password`
- **Role Requirement**: Authenticated.
- **Request Body**: `{ "currentPassword": "...", "newPassword": "..." }`
- **Response (200 OK)**: Password updated and clears `mustChangePassword` flag.

### `POST /api/auth/forgot-password`
- **Role Requirement**: Public.
- **Request Body**: `{ "email": "user@example.com" }`
- **Response (200 OK)**: Universal message regardless of whether email exists (prevents account enumeration).

### `POST /api/auth/reset-password`
- **Role Requirement**: Public.
- **Request Body**: `{ "token": "...", "newPassword": "..." }`
- **Response (200 OK)**: Password reset and revokes all active sessions.

---

## 3. Patient Management API (`/api/patients`)

### `GET /api/patients`
- **Role Requirement**: `doctor` or `admin`.
- **Query Params**: `search`, `status`, `page`, `limit`, `sortBy`, `order`.
- **Response (200 OK)**: Paginated patient roster with session status.

### `POST /api/patients`
- **Role Requirement**: `doctor` or `admin`.
- **Request Body**: `{ "name": "...", "email": "...", "dob": "...", "emergencyContact": { ... } }`
- **Response (201 Created)**: Newly registered patient record and sends activation email.

### `GET /api/patients/:patientId`
- **Role Requirement**: `patient` (own record only) or `doctor`/`admin` (any record).
- **Response (200 OK)**: Demographics, baseline threshold profile, and session history. Logs `AuditEvent` on doctor access.
- **Errors**: `403 Forbidden` if a patient attempts accessing another patient's profile.

### `POST /api/patients/:patientId/photo`
- **Role Requirement**: `patient` (own) or `doctor`/`admin`.
- **Body**: `multipart/form-data` with `file` field.
- **Validation**: Magic byte verification for JPEG/PNG/WebP, Sharp re-encoding to 512px, EXIF stripping.
- **Response (200 OK)**: Updated `profileImage` metadata.

### `GET /api/patients/:patientId/photo`
- **Role Requirement**: Authenticated.
- **Response (200 OK)**: 5-minute pre-signed access URL.

### `GET /api/patients/:patientId/notes`
- **Role Requirement**: Authenticated.
- **Response (200 OK)**: Clinical progress notes. Patients view only notes flagged `visibleToPatient: true`.

### `POST /api/patients/:patientId/notes`
- **Role Requirement**: `doctor`.
- **Request Body**: `{ "content": "Patient vitals stabilized", "visibleToPatient": true }`
- **Response (201 Created)**: Created clinical progress note.

---

## 4. Telemetry Monitoring Sessions API (`/api/sessions`)

### `POST /api/sessions`
- **Role Requirement**: `doctor` or `admin`.
- **Request Body**: `{ "patientId": "PC-102938", "deviceId": "PCD-0001", "notes": "Post-op ICU observation" }`
- **Response (201 Created)**: Starts new active session, locks device, snapshots patient's threshold profile.
- **Errors**: `409 Conflict` if device is already attached to an active session.

### `GET /api/sessions/:sessionId`
- **Role Requirement**: Authenticated.
- **Response (200 OK)**: Session details, active status, start time, device metadata.

### `POST /api/sessions/:sessionId/stop`
- **Role Requirement**: `doctor` or `admin`.
- **Request Body**: `{ "notes": "Discharged from ICU telemetry" }`
- **Response (200 OK)**: Concludes session, releases device, persists discharge summary.

### `GET /api/sessions/:sessionId/summary`
- **Role Requirement**: Authenticated.
- **Response (200 OK)**: Minimum, maximum, average, median per vital, duration in minutes, % valid data, and alert counts.

### `GET /api/sessions/compare?a=:sessionId&b=:sessionId`
- **Role Requirement**: `doctor` or `admin`.
- **Response (200 OK)**: Mathematical delta comparison between two sessions (averages, durations, quality warnings; strictly clinical numbers without speculative NLP text).

---

## 5. IoT Hardware Bedside Node API (`/api/device` and `/api/devices`)

### `POST /api/devices`
- **Role Requirement**: `admin`.
- **Request Body**: `{ "deviceId": "PCD-0005", "label": "ICU Bed 5 Monitor" }`
- **Response (201 Created)**: Returns device record and a one-time 15-minute pairing code.

### `POST /api/device/pair`
- **Role Requirement**: Public (Requires valid one-time pairing code).
- **Request Body**: `{ "deviceId": "PCD-0005", "pairingCode": "123456" }`
- **Response (200 OK)**: Returns permanent 64-character hex `deviceKey` once. Server stores only hashed key.

### `POST /api/device/heartbeat`
- **Role Requirement**: Device HMAC-SHA256 signature.
- **Request Body**: `{ "firmwareVersion": "1.2.0", "rssi": -58, "uptime": 3600, "freeHeap": 182400 }`
- **Response (200 OK)**: Node health acknowledged.

### `POST /api/device/readings`
- **Role Requirement**: Device HMAC-SHA256 signature.
- **Request Body (Single or Batch Array)**:
  ```json
  [
    {
      "seq": 104,
      "ts": 1729892010000,
      "heartRate": 74,
      "spo2": 98,
      "temperatureC": 36.8,
      "fingerDetected": true,
      "signalQuality": 95
    }
  ]
  ```
- **Response (200 OK)**: Telemetry ingested, broadcast over Socket.IO, and evaluated against alert engine.

---

## 6. Clinical Alerts & Thresholds API (`/api/alerts`, `/api/thresholds`)

### `GET /api/alerts`
- **Role Requirement**: Authenticated (`patient` sees only own alerts; `doctor`/`admin` see all).
- **Query Params**: `patientId`, `sessionId`, `status`, `severity`, `type`, `page`, `limit`.
- **Response (200 OK)**: Paginated alert list.

### `POST /api/alerts/:id/acknowledge`
- **Role Requirement**: `doctor` or `admin`.
- **Request Body**: `{ "note": "Adjusted oxygen cannula flow rate to 2L/min" }`
- **Response (200 OK)**: Marks alert acknowledged with clinician ID and timestamp.

### `GET /api/thresholds`
- **Role Requirement**: `doctor` or `admin`.
- **Query Params**: `patientId` (optional).
- **Response (200 OK)**: Resolved physiological threshold profile.

### `PUT /api/thresholds`
- **Role Requirement**: `doctor` or `admin`.
- **Request Body**:
  ```json
  {
    "patientId": "PC-102938",
    "heartRate": { "min": 50, "max": 110 },
    "spo2": { "min": 92 },
    "temperatureC": { "min": 35.5, "max": 38.0 },
    "persistenceSeconds": 3,
    "trendRules": { "heartRateDeltaPercent": 20, "windowMinutes": 5 }
  }
  ```
- **Response (200 OK)**: Validates `min < max`, saves override, and logs audit event.

---

## 7. Reports & Data Export API (`/api/reports`, `/api/privacy`)

### `GET /api/sessions/:sessionId/report.pdf`
- **Role Requirement**: Authenticated (`patient` own only, `doctor`/`admin` any).
- **Response (200 OK)**: Direct binary stream of vector PDF report (`application/pdf`). Missing values render as `"Not available"`, never `0`.

### `GET /api/sessions/:sessionId/readings.csv`
- **Role Requirement**: Authenticated.
- **Response (200 OK)**: CSV telemetry stream with formula injection defense (`='`, `+'`, `-'`, `@'`).

### `GET /api/privacy/export-data`
- **Role Requirement**: Authenticated (`patient`).
- **Response (200 OK)**: GDPR/DPDP compliant ZIP archive containing JSON profile and CSV telemetry histories.

### `POST /api/privacy/delete-request`
- **Role Requirement**: Authenticated (`patient`).
- **Response (200 OK)**: Initiates 7-day cooling period before permanent cryptographic deletion.

### `POST /api/privacy/cancel-delete`
- **Role Requirement**: Authenticated (`patient` with pending deletion).
- **Response (200 OK)**: Restores account status to `active`.

---

## 8. Admin & Operational Governance API (`/api/admin`, `/api/health`)

### `GET /api/admin/users`
- **Role Requirement**: `admin`.
- **Response (200 OK)**: Comprehensive staff and patient account directory.

### `POST /api/admin/invitations`
- **Role Requirement**: `admin`.
- **Request Body**: `{ "email": "doctor.smith@hospital.org", "name": "Dr. Smith", "role": "doctor" }`
- **Response (201 Created)**: Generates 48-hour cryptographic token and dispatches invite email.

### `PATCH /api/admin/users/:id/role`
- **Role Requirement**: `admin`.
- **Request Body**: `{ "role": "doctor" }`
- **Response (200 OK)**: Updates role. Enforces last-admin safety protection (cannot demote or disable final active admin).

### `GET /api/health` and `GET /api/health/ready`
- **Role Requirement**: Public.
- **Response (200 OK / 503 Service Unavailable)**: Database connectivity probe, uptime, and memory statistics.
