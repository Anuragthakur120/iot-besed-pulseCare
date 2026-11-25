# PulseCare: IoT-Based Hospital Patient Monitoring & Early Warning System

> **Enterprise-grade, real-time clinical IoT patient telemetry and early warning platform** designed for hospital wards, outpatient step-down units, and ICUs. Connects ESP32-based multi-sensor wearable bedside nodes to a secure Node.js micro-architecture with MongoDB and a modern React dashboard.

---

## ✨ Key Highlights

| Feature | Description |
|:--------|:------------|
| **Hardware Bedside Telemetry** | MAX30102 (PPG Heart Rate & SpO₂) + DS18B20 (Temperature) on ESP32 with FreeRTOS dual-core scheduling and SSD1306 OLED display |
| **Hardware Security** | HMAC-SHA256 signed payloads with device-specific keys, nonces, and <60s timestamp validation |
| **Intelligent Alert Engine** | Clinical threshold evaluation with multi-second debounce, trend delta rules, duplicate suppression, automatic recovery |
| **Clinical Governance** | RBAC (Doctor/Admin/Patient), HIPAA audit trails, GDPR/DPDP export & deletion rights, age-group threshold profiles |
| **Real-Time Dashboard** | Socket.IO live vitals, historical Recharts graphs, vector PDF reports, CSV exports (formula-injection safe) |
| **Full Test Suite** | 60+ unit/integration tests (Vitest + RTL), Playwright E2E, GitHub Actions CI |

---

## 🏗 Tech Stack

| Layer | Technology |
|:------|:-----------|
| **Frontend** | React 18, Vite 6, TailwindCSS 3, Recharts, Socket.IO Client, i18next, Axios |
| **Backend** | Node.js 20+, Express 4, Socket.IO 4, Pino logger, Zod validation |
| **Database** | MongoDB 7+ (Mongoose 8), `@pulsecare/database` shared workspace |
| **Firmware** | ESP32 (C++ / Arduino), FreeRTOS, MAX30102, DS18B20, SSD1306 OLED |
| **Security** | JWT (access + refresh tokens), bcrypt, Helmet, CORS, rate-limiting, HPP, mongo-sanitize |
| **Email** | Nodemailer (SMTP — Mailtrap for dev, SendGrid/SES for prod) |
| **SMS** | Twilio REST API (optional, critical alerts only) |
| **Storage** | Local filesystem + Sharp image processing (Cloudinary-ready) |
| **DevOps** | Docker multi-stage builds, docker-compose (dev + prod), GitHub Actions CI |

---

## 📁 Monorepo Architecture

```text
pulsecare/
├── package.json              # Monorepo workspaces config (npm workspaces)
├── docker-compose.yml        # Development Docker Compose (Mongo + Backend + Frontend)
├── docker-compose.prod.yml   # Production Docker Compose (multi-stage, healthchecks)
├── .github/workflows/ci.yml  # GitHub Actions CI (lint → test → build)
├── .env.example              # Root environment template
├── .dockerignore             # Docker build exclusions
│
├── database/                 # @pulsecare/database — Mongoose connection + 12 schemas
│   ├── package.json
│   └── src/
│
├── backend/                  # Express REST API + Socket.IO + Alert Engine
│   ├── Dockerfile            # Multi-stage Node.js production image
│   ├── .env.example          # Backend env template (all variables documented)
│   ├── package.json
│   └── src/
│       ├── server.js          # HTTP + Socket.IO bootstrap
│       ├── app.js             # Express middleware chain
│       ├── config/env.js      # Zod-validated environment loader
│       ├── controllers/       # 12 REST controllers
│       ├── routes/            # 12 route modules + health checks
│       ├── middleware/        # Auth, audit, device HMAC, rate-limit
│       ├── services/          # Alert engine + multi-channel notifier
│       ├── sockets/           # Real-time telemetry handlers
│       ├── jobs/              # Cron: data retention, appointment reminders
│       ├── utils/             # Crypto, mailer, photo storage, JWT, Swagger
│       └── validators/        # Zod request schemas
│
├── frontend/                 # Vite + React 18 + TailwindCSS Dashboard
│   ├── Dockerfile            # Multi-stage Vite build → Nginx
│   ├── .env.example          # Frontend env template (VITE_ prefixed)
│   ├── package.json
│   └── src/
│       ├── components/        # Reusable UI (charts, forms, alerts, layout)
│       ├── pages/             # Admin, Doctor, Patient, Monitoring, Auth pages
│       ├── contexts/          # AuthContext, ThemeContext, SocketContext
│       ├── hooks/             # Custom React hooks
│       ├── services/          # Axios API client + Socket.IO client
│       └── utils/             # Audio alerts, classname helpers
│
├── firmware/                 # ESP32 C++ FreeRTOS firmware
│   ├── pulsecare_esp32/
│   │   ├── pulsecare_esp32.ino  # Main sketch
│   │   ├── config.example.h     # Template (copy to config.h)
│   │   ├── network.h            # WiFi + HTTPS + telemetry POST
│   │   ├── sensors.h            # MAX30102 + DS18B20 drivers
│   │   ├── display.h            # SSD1306 OLED rendering
│   │   └── storage.h            # SPIFFS offline caching
│   └── simulator.js          # Node.js device simulator for testing
│
├── docs/                     # Technical documentation suite
│   ├── SETUP.md              # Production deployment guide
│   ├── API.md                # Full REST endpoint reference
│   ├── ARCHITECTURE.md       # System architecture + data flow
│   ├── SECURITY.md           # Threat model, HMAC, replay prevention
│   ├── HARDWARE_WIRING.md    # ESP32 GPIO pinout, wiring schematic
│   ├── CALIBRATION.md        # Sensor calibration protocol
│   ├── LIMITATIONS.md        # Non-medical disclaimer
│   ├── FUTURE_SCOPE.md       # Roadmap: ECG, BLE, MQTT, ML
│   └── ACADEMIC_EXTRAS.md    # Presentation outline, video script, viva Q&A
│
└── e2e/                      # Playwright end-to-end tests
```

---

## 🚀 Quick Start

### Prerequisites

| Tool | Version | Purpose |
|:-----|:--------|:--------|
| **Node.js** | ≥ 20.0.0 | Runtime for backend & frontend build |
| **npm** | ≥ 10 | Package management (npm workspaces) |
| **MongoDB** | ≥ 7.0 | Database (local service or Docker) |
| **Docker** *(optional)* | ≥ 24 | Containerized development/production |

### Option A: Docker (Recommended)

```bash
# Clone & start entire stack with one command
git clone https://github.com/Anuragthakur120/iot-besed-pulseCare.git
cd iot-besed-pulseCare

# Copy and configure environment
cp backend/.env.example backend/.env
# Edit backend/.env — fill in JWT secrets, SMTP credentials, etc.

# Development (with hot reload & healthchecks)
docker compose up --build

# Production mode
docker compose -f docker-compose.prod.yml up --build -d
```

### Option B: Local Node.js

```bash
# 1. Clone repository
git clone https://github.com/Anuragthakur120/iot-besed-pulseCare.git
cd iot-besed-pulseCare

# 2. Install all workspace dependencies
npm install

# 3. Configure environment
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# Edit backend/.env — fill in your secrets (see Environment Variables table below)

# 4. Start MongoDB (if not running)
# macOS: brew services start mongodb-community
# Ubuntu: sudo systemctl start mongod
# Windows: net start MongoDB
# Docker: docker run -d -p 27017:27017 mongo:7

# 5. Create initial administrator account
npm run create-admin

# 6. Launch development servers (backend + frontend concurrently)
npm run dev
```

**Development URLs:**

| Service | URL |
|:--------|:----|
| Frontend Dashboard | http://localhost:5173 |
| Backend API Server | http://localhost:5000 |
| Swagger API Docs | http://localhost:5000/api/docs |
| Health Check | http://localhost:5000/api/health |
| Readiness Probe | http://localhost:5000/api/health/ready |

---

## 🔐 Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Description | Example / Where to Get |
|:---------|:--------:|:------------|:-----------------------|
| `NODE_ENV` | ✅ | Environment mode | `development` / `production` / `test` |
| `PORT` | ✅ | Backend HTTP port | `5000` |
| `CLIENT_ORIGIN` | ✅ | Frontend origin(s) for CORS | `http://localhost:5173` |
| `MONGODB_URI` | ✅ | MongoDB connection string | `mongodb://localhost:27017/pulsecare` or MongoDB Atlas URI |
| `JWT_ACCESS_SECRET` | ✅ | JWT access token signing key (≥32 chars) | Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `JWT_REFRESH_SECRET` | ✅ | JWT refresh token signing key (≥32 chars) | Generate same as above |
| `ACCESS_TOKEN_TTL` | | Access token lifetime | `15m` |
| `REFRESH_TOKEN_TTL` | | Refresh token lifetime | `7d` |
| `COOKIE_SECURE` | | Secure cookie flag (HTTPS) | `false` (dev) / `true` (prod) |
| `CLOUDINARY_CLOUD_NAME` | | Cloudinary cloud name | From [Cloudinary Console](https://cloudinary.com/console) |
| `CLOUDINARY_API_KEY` | | Cloudinary API key | From Cloudinary Console |
| `CLOUDINARY_API_SECRET` | | Cloudinary API secret | From Cloudinary Console |
| `SMTP_HOST` | | SMTP server hostname | `smtp.mailtrap.io` (dev) / `smtp.sendgrid.net` (prod) |
| `SMTP_PORT` | | SMTP port | `2525` (Mailtrap) / `587` (SendGrid) |
| `SMTP_USER` | | SMTP username | From your email provider |
| `SMTP_PASS` | | SMTP password / API key | From your email provider |
| `SMTP_FROM` | | Sender email address | `alerts@yourdomain.com` |
| `ALERT_EMAIL_ENABLED` | | Enable email alerts | `false` / `true` |
| `ALERT_SMS_ENABLED` | | Enable SMS for critical alerts | `false` / `true` |
| `TWILIO_ACCOUNT_SID` | | Twilio Account SID | From [Twilio Console](https://console.twilio.com/) |
| `TWILIO_AUTH_TOKEN` | | Twilio Auth Token | From Twilio Console |
| `TWILIO_PHONE_NUMBER` | | Twilio sender phone number | From Twilio Console |
| `DEVICE_HMAC_PEPPER` | ✅ | HMAC pepper for ESP32 device auth | Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `STALE_THRESHOLD_SECONDS` | | Device reading staleness cutoff | `15` |
| `RAW_READING_RETENTION_DAYS` | | Auto-delete raw readings after N days | `30` |
| `SENTRY_DSN` | | Sentry error tracking DSN | From [Sentry](https://sentry.io/) |
| `ENABLE_SWAGGER` | | Serve Swagger UI at /api/docs | `true` |
| `SEED_ADMIN_EMAIL` | | Dev seed admin email | `admin@pulsecare.dev` |
| `SEED_ADMIN_PASSWORD` | | Dev seed admin password | Your chosen password |
| `SEED_FORCE_RESET` | | Force re-seed on startup | `false` |

### Frontend (`frontend/.env`)

| Variable | Required | Description | Example |
|:---------|:--------:|:------------|:--------|
| `VITE_API_URL` | ✅ | Backend API base URL | `http://localhost:5000` |
| `VITE_SOCKET_URL` | ✅ | Socket.IO server URL | `http://localhost:5000` |

### ESP32 Firmware (`firmware/pulsecare_esp32/config.h`)

| Define | Description |
|:-------|:------------|
| `WIFI_SSID` | Hospital/lab WiFi network name |
| `WIFI_PASSWORD` | WiFi password |
| `API_BASE_URL` | Backend server IP + port |
| `DEVICE_ID` | Unique device identifier (e.g., `PCD-0001`) |

> Copy `config.example.h` → `config.h` and fill in your values. `config.h` is gitignored.

---

## 🧪 Testing

```bash
# Run ALL workspace tests (database + backend + frontend)
npm test

# Backend tests only (43 unit/integration tests with Vitest)
npm test --workspace=backend

# Frontend tests only (18 component tests with Vitest + React Testing Library)
npm test --workspace=frontend

# End-to-End tests (Playwright — requires running dev servers)
npm run test:e2e
```

---

## 🐳 Docker Deployment

### Development

```bash
docker compose up --build
```

### Production

```bash
# Set environment variables in a .env file or export them
docker compose -f docker-compose.prod.yml up --build -d
```

The production compose file uses environment variable substitution (`${VAR}`), so set all required variables before running.

---

## 📖 Documentation Suite

| Document | Description |
|:---------|:------------|
| [docs/SETUP.md](docs/SETUP.md) | Step-by-step production deployment (Atlas, Render, Vercel, Backup & Recovery) |
| [docs/API.md](docs/API.md) | Full REST endpoint specifications, schemas, auth levels, error codes |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System architecture with data flow diagram (ESP32 → Express → React) |
| [docs/SECURITY.md](docs/SECURITY.md) | Threat model, HMAC signatures, replay prevention, data privacy |
| [docs/HARDWARE_WIRING.md](docs/HARDWARE_WIRING.md) | ESP32 GPIO pinout, MAX30102 I2C wiring, DS18B20 1-Wire schematic |
| [docs/CALIBRATION.md](docs/CALIBRATION.md) | Sensor calibration protocol against certified medical equipment |
| [docs/LIMITATIONS.md](docs/LIMITATIONS.md) | Non-medical device disclaimer, ambient light noise, motion artifacts |
| [docs/FUTURE_SCOPE.md](docs/FUTURE_SCOPE.md) | Roadmap: ECG AD8232, MPU6050, BLE, MQTT broker, ML anomaly detection |
| [docs/ACADEMIC_EXTRAS.md](docs/ACADEMIC_EXTRAS.md) | Presentation outline, video script, 20 Viva Q&A |

---

## 🌐 Deployment Guide (Free/Cheap)

### Recommended Platforms

| Component | Platform | Free Tier |
|:----------|:---------|:----------|
| **Backend API** | [Render](https://render.com) | 750 hrs/month free |
| **Frontend** | [Vercel](https://vercel.com) | Unlimited for personal |
| **Database** | [MongoDB Atlas](https://www.mongodb.com/atlas) | 512 MB free (M0 cluster) |
| **SMTP Email** | [Mailtrap](https://mailtrap.io) | 500 emails/month free |
| **SMS** | [Twilio](https://twilio.com) | Trial credits included |
| **Image Storage** | [Cloudinary](https://cloudinary.com) | 25 GB free |

### Deploy Steps

1. **MongoDB Atlas**: Create M0 free cluster → Get connection string → Set as `MONGODB_URI`
2. **Render (Backend)**: New Web Service → Connect GitHub repo → Root Dir: `.` → Build: `npm install` → Start: `npm run start --workspace=backend` → Set env vars in Render dashboard
3. **Vercel (Frontend)**: Import GitHub repo → Root Dir: `frontend` → Framework: Vite → Set `VITE_API_URL` and `VITE_SOCKET_URL` to Render backend URL
4. **Update CORS**: Set `CLIENT_ORIGIN` in backend env to your Vercel frontend URL

> See [docs/SETUP.md](docs/SETUP.md) for detailed production deployment instructions.

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
