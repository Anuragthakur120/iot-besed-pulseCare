# PulseCare Security Architecture & Threat Model

PulseCare implements a defense-in-depth security model to safeguard protected health information (PHI) and clinical telemetry across hardware, transport, storage, and presentation layers.

---

## 1. Threat Model (STRIDE Analysis)

| STRIDE Category | Threat Vector | System Countermeasure |
| :--- | :--- | :--- |
| **Spoofing** | Rogue rogue device or malicious user impersonating a bedside node or clinician | - Hardware nodes authenticate via HMAC-SHA256 with stored keys.<br/>- Clinicians authenticate via JWT access tokens and signed `HttpOnly` refresh cookies. |
| **Tampering** | Man-in-the-middle modification of telemetry packets or stored records | - Transport Layer Security (TLS 1.3 / HTTPS) enforced.<br/>- HMAC signature covers HTTP method, path, timestamp, nonce, and payload SHA256.<br/>- Mongoose schema validation and Zod input sanitization. |
| **Repudiation** | User denies performing an action (e.g. altering thresholds or discharging a patient) | - Comprehensive, immutable `AuditEvent` log records actor ID, role, IP address, timestamp, resource ID, action, and changes. |
| **Information Disclosure** | Unauthorized snooping of patient vitals or medical records | - Strict role-based routing (`doctor`, `admin`, `patient`).<br/>- Patients cannot query other patient records.<br/>- Device keys encrypted at rest using AES-256-GCM.<br/>- Research CSV exports anonymized with salted SHA-256 hashes. |
| **Denial of Service** | Flooding backend ingestion endpoint or brute-forcing clinician passwords | - Per-device rate limiting (max 120 req/min).<br/>- Express rate limiting on auth endpoints (5 failed logins trigger 15-minute lockout).<br/>- Dual-core ESP32 isolates sampling from network transport. |
| **Elevation of Privilege** | Normal user or patient attempting to invoke administrative endpoints | - Strict middleware gates (`requireRole('admin')`).<br/>- Last-admin protection prevents removing or disabling the final active administrator. |

---

## 2. Hardware Security & Replay Prevention

Bedside IoT devices transmit over open hospital Wi-Fi networks and are physically exposed. The following cryptographic controls are enforced:

### 1. One-Time Pairing Code Handshake
- Administrators provision devices in the portal, creating a 6-digit numeric pairing code valid for 15 minutes.
- The device invokes `POST /api/device/pair` once with the pairing code.
- The server generates a random 64-character hexadecimal device secret, stores only its SHA-256 hash or AES-256-GCM encrypted ciphertext, and returns the plain key to the device once.
- The pairing code is immediately burned.

### 2. HMAC-SHA256 Signature Verification
Every telemetry packet includes four verification headers:
- `X-Device-Id`: Upper-case hardware serial ID.
- `X-Timestamp`: Current UTC epoch time in seconds.
- `X-Nonce`: 32-character random hex string.
- `X-Signature`: Hex-encoded HMAC-SHA256 signature calculated over:
  ```text
  METHOD:PATH:TIMESTAMP:NONCE:SHA256(REQUEST_BODY)
  ```

### 3. Timestamp Window & Nonce Cache
- The server rejects any request where `|server_time - X-Timestamp| > 60 seconds` to prevent delayed replays.
- The server tracks used nonces in a memory cache with a 60-second TTL. If a nonce is repeated within the validity window, the request is rejected with `401 Unauthorized`.

---

## 3. Web & Authentication Security

### Token Architecture
- **Access Tokens**: Short-lived (15 minutes), signed with `JWT_ACCESS_SECRET`, transported in the HTTP `Authorization: Bearer <token>` header. Never stored in localStorage.
- **Refresh Tokens**: Long-lived (7 days), signed with `JWT_REFRESH_SECRET`, stored in an `HttpOnly`, `SameSite=Lax` (or `None` with `Secure`), signed cookie.
- **Token Rotation & Automatic Reuse Detection**:
  - Each refresh invocation issues a new refresh token and invalidates the previous one.
  - If a revoked refresh token is re-submitted (indicating token theft), the server immediately revokes the entire token family, logging out all sessions for that account.

### Account Lockout
- Accounts track `failedLoginAttempts`.
- After 5 consecutive failed passwords, `lockUntil` is set for 15 minutes, blocking all authentication attempts and returning HTTP 423.

---

## 4. Patient Boundary & Data Isolation

- **Patient Self-Access Only**: The patient dashboard queries `/api/patients/:patientId`. If `req.user.role === 'patient'` and `req.user.patientId !== req.params.patientId`, the request is immediately aborted with `403 Forbidden`.
- **Note Visibility**: Clinicians can author internal observations marked `visibleToPatient: false`. When patients query notes, the database query enforces `{ visibleToPatient: true }`.
- **Photo Upload Sanitization**:
  - Validates file content using magic bytes (not just file extension).
  - Re-encodes the image with Sharp to 512x512 pixels, stripping all EXIF metadata and GPS tags.
  - Uploads to private object storage and serves via 5-minute pre-signed URLs.

---

## 5. CSV Formula Injection Defense

Exporting patient telemetry or audit logs to CSV poses a Remote Code Execution risk if opened in Microsoft Excel or Google Sheets. Malicious inputs starting with formula prefixes (`=`, `+`, `-`, `@`) can trigger spreadsheet DDE execution.

PulseCare automatically sanitizes every exported cell:
```javascript
export function escapeCsvField(val) {
  if (val === null || val === undefined) return '';
  const str = String(val).trim();
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`; // Prefix with single apostrophe to force plain text rendering
  }
  return str;
}
```

---

## 6. Privacy & Regulatory Compliance (GDPR & DPDP)

- **Consent Tracking**: User registration requires explicit consent flag (`consent: true`).
- **Data Portability**: `GET /api/privacy/export-data` streams a compressed ZIP containing all demographics, appointments, and telemetry history in open JSON and CSV formats.
- **Right to Erasure (7-Day Cooling Window)**:
  - Patients can initiate deletion via `POST /api/privacy/delete-request`.
  - The account is disabled with `deletionScheduledAt` set 7 days into the future.
  - During this window, the patient can log in and cancel deletion via `POST /api/privacy/cancel-delete`.
  - Once expired, a daily retention cron purges all identifying records permanently.
