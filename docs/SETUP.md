# PulseCare Production Deployment & Operations Guide

This guide walks you through deploying PulseCare to production from scratch in a secure, compliant manner. Every step is numbered and beginner-friendly.

---

## 1. Cloud Database Provisioning (MongoDB Atlas)

Never use an unsecured or local database instance in clinical environments.

1. **Create an Atlas Account & Project**:
   - Log in to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
   - Click **New Project** and name it `PulseCare-Hospital-Prod`.
2. **Deploy Cluster**:
   - Select **Create a Cluster** (M10+ recommended for clinical workloads with automated backups, or free M0 sandbox for evaluation).
   - Select a cloud provider (AWS / GCP / Azure) and a region closest to your hospital facility.
3. **Configure Least-Privilege Database User**:
   - Navigate to **Database Access** -> **Add New Database User**.
   - Authentication Method: **Password**.
   - Username: `pulsecare_app_prod`.
   - Built-in Roles: Select **Specific Privileges** -> Grant `readWrite` on only the `pulsecare` database. Do not grant `atlasAdmin` or cluster-wide privileges.
4. **Harden Network Security (IP Whitelisting)**:
   - Navigate to **Network Access** -> **Add IP Address**.
   - **CRITICAL**: Do **NOT** select `0.0.0.0/0` (Allow Access from Anywhere) in production!
   - Add only the static outbound IP addresses of your backend deployment server (e.g. Render/Railway outbound IPs or hospital VPN gateway).
5. **Extract Connection String**:
   - Go to **Database Deployments** -> Click **Connect** -> **Drivers** (Node.js).
   - Copy connection URI format:
     ```text
     mongodb+srv://pulsecare_app_prod:<PASSWORD>@pulsecare-cluster.mongodb.net/pulsecare?retryWrites=true&w=majority&appName=PulseCare
     ```

---

## 2. Medical Document & Avatar Storage (Cloudinary or AWS S3)

PulseCare isolates patient profile photographs and clinical document attachments using pre-signed temporary URLs.

### Option A: Cloudinary Private Delivery
1. Create a Cloudinary account.
2. In Settings -> **Upload Presets**, configure a preset with `type: authenticated` or `type: private`.
3. In backend `.env`, configure:
   ```env
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   ```

### Option B: AWS S3 Private Bucket
1. Create an S3 Bucket: `pulsecare-clinical-vault-prod`.
2. Enable **Block All Public Access** (100% private).
3. Enable **Default Server-Side Encryption** (AES-256 or AWS-KMS).
4. Create an IAM User with a policy allowing `s3:PutObject`, `s3:GetObject`, and `s3:DeleteObject` on `arn:aws:s3:::pulsecare-clinical-vault-prod/*`.
5. Access objects strictly through backend-generated 5-minute pre-signed URLs.

---

## 3. Backend Deployment (Render or Railway)

The backend runs Express, Node-Cron background schedulers, and Socket.IO on Node.js 20.

1. **Create Web Service**:
   - Connect your GitHub repository to [Render](https://render.com) or [Railway](https://railway.app).
   - Root Directory: `backend` (or use the root `Dockerfile` targeting `backend/Dockerfile`).
   - Build Command: `npm ci --workspace=backend --workspace=database`
   - Start Command: `npm start --workspace=backend`
2. **Health Check Path**:
   - Set the Health Check Endpoint to: `/api/health/ready`
   - Render/Railway will poll this endpoint to verify database connectivity before routing traffic.
3. **Environment Variables**:
   Configure these variables in your host dashboard:
   ```env
   NODE_ENV=production
   PORT=5000
   MONGODB_URI=mongodb+srv://pulsecare_app_prod:***@pulsecare-cluster.mongodb.net/pulsecare?retryWrites=true&w=majority
   CLIENT_ORIGIN=https://pulsecare.hospital.org
   JWT_ACCESS_SECRET=paste_at_least_32_random_bytes_hex_or_base64
   JWT_REFRESH_SECRET=paste_at_least_32_random_bytes_hex_or_base64
   DEVICE_HMAC_SECRET=paste_at_least_32_random_bytes_hex_or_base64
   ENCRYPTION_KEY_HEX=paste_64_character_hex_string_32_bytes
   COOKIE_SECRET=paste_random_cookie_signing_secret_here
   SESSION_IDLE_MINUTES=15
   ALERT_PERSISTENCE_SECONDS=3
   SMTP_HOST=smtp.sendgrid.net
   SMTP_PORT=587
   SMTP_USER=apikey
   SMTP_PASS=your_smtp_api_key
   SMTP_FROM=PulseCare Hospital Alerts <noreply@hospital.org>
   ```
4. **HTTPS Enforcement**:
   - Host providers automatically terminate SSL/TLS at the edge load balancer.
   - PulseCare Helmet configuration enforces `Strict-Transport-Security: max-age=31536000; includeSubDomains`.

---

## 4. Frontend Deployment (Vercel or Netlify)

1. **Import Repository**:
   - Select the `frontend` folder as the Root Directory.
   - Framework Preset: **Vite**.
   - Build Command: `npm run build`
   - Output Directory: `dist`
2. **Environment Variables**:
   - `VITE_API_URL`: `https://api.pulsecare.hospital.org`
   - `VITE_SOCKET_URL`: `https://api.pulsecare.hospital.org`
3. **Single Page Application (SPA) Routing Rewrite Rule**:
   - **Vercel (`vercel.json`)**:
     ```json
     {
       "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
     }
     ```
   - **Netlify (`_redirects`)**:
     ```text
     /*    /index.html   200
     ```

---

## 5. Cross-Domain Cookie & Authentication Security

PulseCare issues `HttpOnly`, signed refresh tokens via cookies.

- **Option A (Shared Parent Domain - Recommended)**:
  - Frontend: `https://app.pulsecare.hospital.org`
  - Backend: `https://api.pulsecare.hospital.org`
  - Set Cookie domain to `.pulsecare.hospital.org` with `SameSite=Lax; Secure`.
- **Option B (Separate Domains)**:
  - Frontend: `https://pulsecare.vercel.app`
  - Backend: `https://pulsecare-api.onrender.com`
  - Set Cookie with `SameSite=None; Secure`.
  - Modern browsers require `Secure` whenever `SameSite=None` is declared.
  - The backend `CLIENT_ORIGIN` must explicitly match the frontend origin (`https://pulsecare.vercel.app`), and `credentials: true` must be enabled.

---

## 6. Creating the First Production Administrator

> [!CAUTION]
> **NEVER run `npm run seed` in production!** The seed script creates hardcoded test credentials (`Password@123`) intended solely for local testing.

To provision the first production administrative account:
1. Run the interactive CLI command in your backend environment (e.g. via Render/Railway SSH shell or local deploy pipeline):
   ```bash
   npm run create-admin
   ```
2. Enter the administrator's full name, email, and a secure password (minimum 10 characters with uppercase, lowercase, numbers, and symbols).
3. The script hashes the password with 12 bcrypt salt rounds and marks `mustChangePassword: true`.
4. The administrator must log in and immediately set a personal password before accessing any clinical data.

---

## 7. Verifying End-to-End System Persistence

Execute this verification checklist immediately after deployment:

1. **Register**: Register a test patient account via `/signup`. Verify that a unique `PC-XXXXXX` patient ID is generated.
2. **Audit Check**: Log in as administrator, view Audit Logs, and verify the registration event is recorded with timestamp and IP address.
3. **Session Termination**: Log out of the patient portal.
4. **Browser Cache Flush**: Completely close and restart your web browser.
5. **Re-Authentication**: Log in with the patient credentials.
6. **Persistence Confirmation**: Check patient profile, clinical notes, and historical telemetry to confirm all data persisted across sessions.

---

## 8. Backup, Restore & Disaster Recovery Drill

### Daily Automated Backups
- MongoDB Atlas performs continuous snapshots and point-in-time recovery (PITR).
- For automated external backups, run `mongodump` via a scheduled cron worker:

```bash
# 1. Create a timestamped compressed backup archive
mongodump --uri="$MONGODB_URI" --archive="pulsecare_backup_$(date +%Y%m%d_%H%M%S).gz" --gzip

# 2. Upload archive to an encrypted off-site cloud storage vault (e.g., S3 Glacier)
aws s3 cp pulsecare_backup_*.gz s3://pulsecare-dr-vault/backups/
```

### Disaster Recovery Drill (Execute Quarterly)
1. Provision a sterile staging MongoDB cluster: `mongodb://localhost:27017/pulsecare-drill`.
2. Download the most recent backup archive from off-site storage.
3. Execute restore drill:
   ```bash
   mongorestore --uri="mongodb://localhost:27017/pulsecare-drill" --archive="pulsecare_backup_20261025.gz" --gzip --drop
   ```
4. Verify document counts across `users`, `readings`, `sessions`, `alerts`, and `auditevents`.
5. Run the automated backend test suite against the restored database to guarantee index consistency:
   ```bash
   MONGODB_URI="mongodb://localhost:27017/pulsecare-drill" npm test --workspace=backend
   ```
