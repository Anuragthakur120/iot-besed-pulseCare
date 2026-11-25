# PulseCare API & Architecture Contract

## Module 8: Alerts, Threshold Profiles, Clinical Reports & Audit Trail

### 1. Alert Engine (`backend/src/services/alertEngine.js`)

#### 1.1 Evaluated Rules (from Session `thresholdSnapshot`)
- **`HR_HIGH`**: Heart Rate exceeds `thresholdSnapshot.hrMax` (e.g. >120 bpm, critical if >150 bpm).
- **`HR_LOW`**: Heart Rate falls below `thresholdSnapshot.hrMin` (e.g. <50 bpm, critical if <35 bpm).
- **`SPO2_LOW`**: SpO2 saturation falls below `thresholdSnapshot.spo2Min` (e.g. <92%, critical if <90%).
- **`TEMP_HIGH`**: Body temperature exceeds `thresholdSnapshot.tempMax` (e.g. >38.0°C).
- **`TEMP_LOW`**: Body temperature falls below `thresholdSnapshot.tempMin` (e.g. <35.5°C).
- **`TREND_HR`**: Heart Rate changes by more than `trendRule.percentChange`% within `trendRule.windowMinutes` minutes.
- **`DEVICE_DISCONNECTED`**: No heartbeat or reading received within 30s during active clinical session.
- **`INVALID_DATA`**: Sensor detachment (`fingerDetected === false`) or severe signal corruption (`signalQuality < 25`).
- **`STALE_DATA`**: Frozen or repeating sequence packets without timestamp progression.

#### 1.2 Debounce & Duplicate Suppression Guarantees
- A condition must persist continuously for `thresholdSnapshot.persistenceSeconds` before an alarm is opened.
- Exactly **one open alert** per `(session, type)` at any time (`resolvedAt: null`).
- Subsequent noisy packets update the existing alert value without creating duplicates.
- **Auto-resolution**: When values return to normal safe thresholds for the recovery window, `resolvedAt` is set to `Date.now()` and an `alert:resolved` event is broadcast.

#### 1.3 Pluggable Multi-Channel Notifier (`backend/src/services/notifier.js`)
- Controlled by environment flags: `ALERT_EMAIL_ENABLED`, `ALERT_SMS_ENABLED`.
- For `critical` alarms only, dispatches SMS via Twilio to the patient's `emergencyContact.phone`.
- Sends email notification to clinician and/or patient emergency contact.

---

### 2. Endpoints Specification

#### 2.1 Alerts
- **`GET /api/alerts`**
  - **Auth**: Patient (own records only), Doctor/Admin (all ward patients).
  - **Query Filters**: `patientId`, `sessionId`, `type`, `status` (`open` | `acknowledged` | `resolved` | `all`), `severity`, `from`, `to`, `page`, `limit`.
  - **Response**: `{ success: true, data: { alerts: [...], pagination: { total, page, limit, pages }, stats: { open, critical } } }`
  - Patient view includes `plainLanguage` friendly descriptions.

- **`POST /api/alerts/:id/acknowledge`**
  - **Auth**: Doctor / Admin / Staff.
  - **Body**: `{ note?: string }`
  - **Response**: `{ success: true, data: { alert } }`
  - Sets `acknowledgedBy`, `acknowledgedAt`, persists `note`, emits `alert:updated` via Socket.IO, and logs `ALERT_ACKNOWLEDGE` audit event.

#### 2.2 Threshold Profiles
- **`GET /api/thresholds`**
  - **Auth**: Doctor / Admin.
  - **Query**: Optional `?patientId=...`
  - **Response**: `{ success: true, data: { defaultProfile, patientProfiles: [...] } }`

- **`PUT /api/thresholds`**
  - **Auth**: Doctor / Admin.
  - **Body**:
    ```json
    {
      "scope": "default" | "patient",
      "patientId": "PC-PAT001",
      "name": "Custom Cardiac ICU Profile",
      "hrMin": 55,
      "hrMax": 115,
      "spo2Min": 93,
      "tempMin": 35.6,
      "tempMax": 37.8,
      "persistenceSeconds": 5,
      "trendRule": { "windowMinutes": 15, "percentChange": 20 }
    }
    ```
  - **Validation Rules**: `hrMin < hrMax`, `tempMin < tempMax`, `spo2Min >= 50 && spo2Min <= 100`, `persistenceSeconds >= 0`, `trendRule.windowMinutes >= 1`, `trendRule.percentChange >= 1`.
  - Logs `THRESHOLD_CHANGE` audit event.

#### 2.3 Reports & Exports
- **`GET /api/sessions/:sessionId/report.pdf`**
  - **Auth**: Owner patient or Doctor/Admin.
  - **Audit**: Logged as `REPORT_DOWNLOAD` (`meta: { format: 'pdf' }`).
  - **Contents**:
    1. PulseCare branding & header.
    2. Patient name, patientId, DOB.
    3. Generation timestamps in **both IST and UTC**.
    4. Session ID, start/end timestamps, duration, device ID.
    5. Summary table: min, max, avg, median, valid data % for HR, SpO2, Temp.
    6. Three vector trend charts rendered server-side via PDFKit (HR, SpO2, Temp).
    7. Readings table (downsampled to 25 representative intervals with explanatory note).
    8. Clinical alerts table.
    9. Data-quality notes: telemetry gaps (>30s), finger detachment counts, invalid samples.
    10. Doctor notes marked `visibleToPatient: true`.
    11. Clinical & regulatory disclaimer: educational prototype, not an approved medical device.
    12. Missing values rendered as `"Not available"`, **never zero**.

- **`GET /api/sessions/:sessionId/readings.csv`**
  - **Auth**: Owner patient or Doctor/Admin.
  - **Audit**: Logged as `REPORT_DOWNLOAD` (`meta: { format: 'csv' }`).
  - **Columns**: `timestamp_utc, timestamp_ist, session_id, hr_bpm, spo2_est_percent, temp_c, finger_detected, signal_quality, valid_hr, valid_spo2, valid_temp`.
  - **Formula Injection Mitigation**: Any cell starting with `=`, `+`, `-`, or `@` is prefixed with `'` (e.g. `"'=1+1"`).

- **`POST /api/reports/generate`**
  - **Auth**: Authenticated.
  - **Body**: `{ sessionId: string }`
  - **Response**: `{ success: true, data: { sessionId, expiresInSeconds: 300, pdfUrl, csvUrl } }`
  - Returns signed short-lived URL valid for 5 minutes.

- **`GET /api/reports/research-export.csv`**
  - **Auth**: Admin only.
  - **Audit**: Logged as `RESEARCH_EXPORT`.
  - **Anonymization**: Removes patient name, email, phone, emergency contact. Replaces `patientId` with salted SHA-256 hash.

#### 2.4 Audit Log
- **`GET /api/audit`**
  - **Auth**: Admin only.
  - **Query Filters**: `actor`, `action`, `target`, `from`, `to`, `format` (`csv` | `json`), `page`, `limit`.
  - **Audited Actions**: `AUTH_LOGIN`, `AUTH_FAILED`, `AUTH_LOGOUT`, `RECORD_VIEW`, `REPORT_DOWNLOAD`, `PHOTO_CHANGE`, `DEVICE_PAIR`, `DEVICE_REVOKE`, `THRESHOLD_CHANGE`, `ROLE_CHANGE`, `SESSION_START`, `SESSION_STOP`, `ALERT_ACKNOWLEDGE`, `RESEARCH_EXPORT`.

---

### 3. Socket.IO Events
- **`alert:new`**: Broadcast when a debounced alert condition opens.
  - Payload: `{ _id, patientId, sessionId, deviceId, type, severity, value, triggeredAt, patient: { patientId, name } }`
- **`alert:updated`**: Broadcast when an open alert value changes or is acknowledged by a clinician.
- **`alert:resolved`**: Broadcast when an open alert condition recovers to safe baseline.
