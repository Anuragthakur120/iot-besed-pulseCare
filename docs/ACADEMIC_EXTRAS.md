# PulseCare Academic Extras: Presentation, Demo Script & Viva Q&A

This document compiles academic resources for project defenses, demonstrations, capstone evaluations, and viva voce examinations.

---

## Part 1: 10-Slide Capstone Presentation Outline

### Slide 1: Title & Introduction
- **Title**: PulseCare: Real-Time IoT Hospital Telemetry & Early Warning System
- **Subtitle**: Continuous Physiological Monitoring, Cryptographic Hardware Security, and Intelligent Clinical Alerting
- **Key Visual**: PulseCare logo, bedside ESP32 prototype node photo, and live web dashboard mockup.

### Slide 2: Clinical Problem Statement
- **The Challenge**: Undetected patient deterioration in general hospital wards due to periodic 4-to-6-hour manual vital sign checks.
- **The Pitfall**: Traditional bedside monitors suffer from severe alarm fatigue (up to 85% false alarms), leading clinicians to ignore or disable auditory alarms.
- **Goal**: Develop a continuous, secure, sub-second telemetry node with debounced, trend-aware early warning alerts.

### Slide 3: System Architecture & Data Flow
- **Architecture**: Distributed three-tier IoT topology (Edge Node -> HTTPS Ingestion Server -> Web Dashboard).
- **Key Visual**: Mermaid data flow diagram showing sensor sampling, HMAC signing, Express/Mongoose pipeline, Socket.IO rooms, and React Recharts.

### Slide 4: Edge Hardware Engineering (ESP32 & FreeRTOS)
- **Controller**: Dual-core ESP32 @ 240 MHz.
- **Task Isolation**:
  - *Core 1*: 100 Hz I2C sampling for MAX30102 PPG and DS18B20 1-Wire temperature, SSD1306 OLED refresh.
  - *Core 0*: Wi-Fi state management, ring buffer queuing (300 points), and HTTPS packet dispatch.
- **Fail-Safe**: If Wi-Fi disconnects, vitals buffer locally in RTC memory without crashing sensor tasks.

### Slide 5: Hardware Security & Cryptographic Replay Defense
- **Device Pairing**: One-time 6-digit pairing code expires in 15 minutes; returns 64-char hex secret key once.
- **Packet Signing**: Every telemetry transmission signed with HMAC-SHA256 over canonical string `METHOD:PATH:TIMESTAMP:NONCE:SHA256(BODY)`.
- **Replay Protection**: Strict 60-second timestamp drift rejection and in-memory TTL nonce cache.

### Slide 6: Intelligent Alert Engine
- **Debounce Window**: Alarms trigger only after abnormal conditions sustain for `persistenceSeconds` (default 3s).
- **Trend Detection**: Flags rapid physiological changes (e.g. Heart Rate changing > 20% in 5 minutes).
- **Suppression & Auto-Recovery**: Enforces single active alarm per `(session, alertType)` and auto-resolves when vitals stabilize.

### Slide 7: Clinical Command Center & Web Dashboard
- **Frontend Stack**: React 18, Vite, Tailwind CSS, Lucide icons, Recharts SVG charting.
- **Real-Time Streaming**: Authenticated Socket.IO with room scoping (`patient:<id>`, `session:<id>`).
- **Clinical UI**: Heartbeat live pulse animation, tabular numerals to prevent layout shift, WCAG AA accessibility, dark mode.

### Slide 8: Empirical Calibration & Validation
- **Benchmark**: Evaluated against certified pulse oximeter and clinical digital thermometer across 10 discrete intervals.
- **Results**:
  - Heart Rate MAE: **0.70 bpm** (RMSE 0.84 bpm).
  - SpO2 MAE: **0.40%** (RMSE 0.63%).
  - Cutaneous temperature offset: **+1.73 °C** relative to core oral temperature.

### Slide 9: Privacy, Governance & Regulatory Compliance
- **RBAC**: Strict role gating (`doctor`, `admin`, `patient`); patients isolated strictly to own charts.
- **Audit Logging**: Immutable audit trail of every patient chart view, login, and threshold modification.
- **Privacy Protections**: Formula injection escaping on CSV exports, 7-day GDPR account deletion cooling window.

### Slide 10: Conclusion & Future Scope
- **Summary**: Delivered a fully functional, end-to-end clinical telemetry system passing 100% of unit, integration, and E2E tests.
- **Roadmap**: AD8232 ECG integration, MPU6050 fall detection, BLE ambulation mode, and server-side ML early warning scores.

---

## Part 2: 3-Minute Live Demonstration Video Script

- **[0:00 - 0:30] Introduction & Setup**:
  - *Visual*: Split screen showing physical ESP32 bedside node with finger in MAX30102 sensor and laptop showing login screen.
  - *Narrator*: "Welcome to PulseCare, an IoT-based hospital telemetry and early warning platform. We are demonstrating a live ESP32 bedside monitor streaming physiological telemetry to our clinical dashboard."
- **[0:30 - 1:00] Doctor Authentication & Session Initiation**:
  - *Visual*: Doctor logs in with `doctor@pulsecare.dev`. Navigates to Live Monitoring and starts a new session for patient Jane Doe with bedside node `PCD-0001`.
  - *Narrator*: "Logging in as Dr. Connor, we start an ICU monitoring session. Notice the system snapshots Jane's baseline physiological thresholds and locks the device exclusively to her bed."
- **[1:00 - 1:45] Real-Time Streaming & Visual Waveform**:
  - *Visual*: Clinician places finger in sensor. OLED displays 74 bpm / 98% SpO2. React dashboard instantly displays green 'LIVE' status pill and smooth SVG charts.
  - *Narrator*: "As the MAX30102 acquires optical PPG signals, the ESP32 calculates heart rate and SpO2 at 100 Hz, signs the packet with HMAC-SHA256, and dispatches it. The React dashboard renders the continuous telemetry profile with sub-second latency via Socket.IO."
- **[1:45 - 2:20] Alarm Engine & Trend Detection Demo**:
  - *Visual*: Telemetry simulator injects high heart rate (130 bpm). The system debounces for 3 seconds, then triggers a red Critical Tachycardia alert with audible alarm tone and notification toast.
  - *Narrator*: "When heart rate surges above the threshold, our alert engine verifies the condition persists beyond the 3-second debounce window before opening a critical alert, preventing false alarms from momentary sensor noise."
- **[2:20 - 3:00] Session Conclude, Audit Trail & PDF Report Download**:
  - *Visual*: Doctor stops session, enters notes, navigates to Reports, and downloads the vector PDF report. Opens PDF showing vector charts, statistics, and regulatory disclaimer.
  - *Narrator*: "Concluding the session releases the device. The doctor downloads an audit-ready, tamper-resistant PDF report featuring vector sparklines, statistical distributions, and missing value guards. This concludes the PulseCare demonstration."

---

## Part 3: Top 20 Viva Voce Examination Questions & Answers

### 1. What is the fundamental problem PulseCare solves?
**Answer**: PulseCare solves the problem of delayed detection of patient deterioration in general hospital wards by replacing manual 4-to-6-hour vital checks with continuous, real-time wireless telemetry, while eliminating alarm fatigue through intelligent debounce filtering.

### 2. Why did you choose FreeRTOS on the ESP32 instead of a single Arduino loop?
**Answer**: Dual-core FreeRTOS allows us to pin high-frequency I2C optical sampling (100 Hz) to Core 1 so that network latencies, Wi-Fi handshakes, and HTTPS POST calls running on Core 0 never block or distort vital sign calculations.

### 3. How does the MAX30102 calculate oxygen saturation (SpO2)?
**Answer**: It emits two wavelengths of light: Red (660 nm) and Infrared (880 nm). Oxygenated hemoglobin absorbs more infrared, while deoxygenated hemoglobin absorbs more red light. By computing the ratio of normalized AC to DC components ($R = (AC_{\text{red}}/DC_{\text{red}}) / (AC_{\text{ir}}/DC_{\text{ir}})$) and applying an empirical second-order polynomial calibration, SpO2 is calculated.

### 4. How do you prevent a malicious actor from replaying recorded telemetry packets?
**Answer**: Every packet includes a unique 32-character hexadecimal nonce and a Unix timestamp. The server enforces a maximum 60-second time drift window and maintains an in-memory TTL nonce cache. If a nonce is reused, the request is rejected immediately with HTTP 401.

### 5. Why HMAC-SHA256 instead of simple API keys?
**Answer**: An API key sent in a header can be intercepted over unencrypted channels or logged in proxies. HMAC-SHA256 signs the HTTP method, path, timestamp, nonce, and request body hash. Any in-flight modification of the payload invalidates the signature without exposing the secret key.

### 6. What prevents alarm fatigue in your Alert Engine?
**Answer**: Three mechanisms:
1. *Persistence Debounce*: Vitals must stay out of bounds for at least `persistenceSeconds` (3s).
2. *Duplicate Suppression*: Only one open alert is permitted per `(session, alertType)`.
3. *Auto-Recovery*: Alerts resolve automatically when values return to normal for consecutive samples.

### 7. Why do you use WebSockets (Socket.IO) instead of HTTP polling?
**Answer**: HTTP polling introduces latency, header overhead (hundreds of bytes per request), and high database read load. Socket.IO maintains an active bi-directional TCP socket, pushing telemetry only when new readings arrive with sub-second latency and minimal network overhead.

### 8. What is the difference between peripheral skin temperature and core body temperature?
**Answer**: The DS18B20 measures peripheral cutaneous skin temperature, which is naturally 1.5 °C to 2.0 °C cooler than core sublingual oral or rectal temperature due to vasoconstriction and ambient room conditions. PulseCare explicitly logs this as skin temperature without applying speculative multipliers.

### 9. How do you handle patient data privacy under GDPR and DPDP?
**Answer**: Patients have explicit consent tracking, can download a complete ZIP export of their clinical history (`/api/privacy/export-data`), and can request account erasure with a 7-day cooling-off safety window (`/api/privacy/delete-request`).

### 10. How is CSV Formula Injection prevented?
**Answer**: Attackers can inject malicious spreadsheet formulas (e.g., `=cmd|' /C calc'!A0`) into patient names. During CSV serialization, any field starting with `=`, `+`, `-`, `@`, `\t`, or `\r` is automatically prefixed with a single quotation mark (`'`), forcing spreadsheet programs to treat it as inert plain text.

### 11. What is the purpose of Refresh Token Rotation?
**Answer**: Access tokens expire after 15 minutes. Refresh tokens are stored in `HttpOnly` cookies and rotated upon every use. If a stolen refresh token is reused, the backend detects family reuse and revokes all active sessions for that user immediately.

### 12. How does the system handle temporary Wi-Fi disconnections at the bedside?
**Answer**: The ESP32 maintains an internal ring buffer capable of storing up to 300 offline telemetry samples. When Wi-Fi connectivity is restored, the node automatically flushes the buffered readings in a batch POST to `/api/device/readings`.

### 13. What is the Last-Admin Protection rule?
**Answer**: In `admin.controller.js`, the system checks whether an administrator being disabled or demoted is the only remaining active admin. If count <= 1, the operation is blocked with HTTP 400 to prevent locking the hospital out of the system.

### 14. What is the difference between `status: 'active'` and `status: 'disabled'` for patient accounts?
**Answer**: An active account has full access. A disabled account is blocked at the authentication middleware level (HTTP 403), except when accessing `/api/privacy/cancel-delete` during a pending deletion cooling period.

### 15. Why does the PDF report generator print "Not available" instead of 0 for missing vitals?
**Answer**: In medicine, printing a Heart Rate of `0 bpm` or SpO2 of `0%` falsely implies asystole (cardiac arrest) or complete anoxia. When a sensor is detached or readings are invalid, rendering `"Not available"` accurately reflects sensor disconnect rather than patient death.

### 16. What is the function of the 4.7 kΩ pull-up resistor on the DS18B20?
**Answer**: The 1-Wire protocol relies on an open-drain bus architecture. Devices can only pull the bus LOW to ground; the external 4.7 kΩ resistor is required to pull the bus HIGH to 3.3V when devices release the line. Without it, the bus floats and reads `-127.00 °C`.

### 17. How do you prevent cross-patient data leaks on the frontend?
**Answer**: Route guards (`RoleRoute`, `ProtectedRoute`) enforce role boundaries, while backend controllers verify `req.user.patientId === req.params.patientId`. Socket.IO rooms are scoped to `patient:<patientId>`, ensuring patients only join and receive their personal room broadcast.

### 18. How are patient profile images validated?
**Answer**: Using Multer memory storage, the backend checks magic file bytes (ensuring the buffer is true JPEG, PNG, or WebP regardless of extension), uses Sharp to re-encode and resize to 512x512, strips all EXIF metadata, and uploads to private cloud storage with a random key.

### 19. What is downsampling and why is it used for historical charts?
**Answer**: A 24-hour monitoring session generates 86,400 readings. Streaming all 86,400 points crashes browser DOM rendering. The server decimates data into time buckets, downsampling to a maximum of 1,000 points while preserving peak maximum and minimum values.

### 20. Is PulseCare a certified medical device?
**Answer**: No. PulseCare is an educational and engineering capstone research prototype. It is not FDA or CE certified as a Class II medical device and is explicitly documented as non-diagnostic in `docs/LIMITATIONS.md` and across all generated medical reports.
