import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure .env is loaded from backend directory or project root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config(); // fallback to current working directory

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),

  // Authentication
  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET must be at least 16 characters'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 characters'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL: z.string().default('7d'),
  COOKIE_SECURE: z.preprocess((val) => {
    if (typeof val === 'string') return val.toLowerCase() === 'true';
    return Boolean(val);
  }, z.boolean().default(false)),

  // Cloudinary Storage
  CLOUDINARY_CLOUD_NAME: z.string().default('placeholder_cloud'),
  CLOUDINARY_API_KEY: z.string().default('placeholder_key'),
  CLOUDINARY_API_SECRET: z.string().default('placeholder_secret'),

  // Email (SMTP)
  SMTP_HOST: z.string().default('smtp.mailtrap.io'),
  SMTP_PORT: z.coerce.number().default(2525),
  SMTP_USER: z.string().default('smtp_user_placeholder'),
  SMTP_PASS: z.string().default('smtp_pass_placeholder'),
  SMTP_FROM: z.string().default('alerts@pulsecare.local'),

  // Alert Notifications
  ALERT_EMAIL_ENABLED: z.preprocess((val) => {
    if (typeof val === 'string') return val.toLowerCase() === 'true';
    return Boolean(val);
  }, z.boolean().default(false)),
  ALERT_SMS_ENABLED: z.preprocess((val) => {
    if (typeof val === 'string') return val.toLowerCase() === 'true';
    return Boolean(val);
  }, z.boolean().default(false)),
  TWILIO_ACCOUNT_SID: z.string().default(''),
  TWILIO_AUTH_TOKEN: z.string().default(''),
  TWILIO_PHONE_NUMBER: z.string().default(''),

  // IoT Hardware Security
  DEVICE_HMAC_PEPPER: z.string().min(8, 'DEVICE_HMAC_PEPPER is required for sensor authentication'),
  STALE_THRESHOLD_SECONDS: z.coerce.number().positive().default(15),

  // Module 9 - Ops & Lifecycle Governance
  RAW_READING_RETENTION_DAYS: z.coerce.number().int().positive().default(30),
  SENTRY_DSN: z.string().default(''),
  ENABLE_SWAGGER: z.preprocess((val) => {
    if (typeof val === 'string') return val.toLowerCase() === 'true';
    return Boolean(val);
  }, z.boolean().default(true)),
  INVITATION_TTL_HOURS: z.coerce.number().int().positive().default(48),
  DELETION_COOLING_DAYS: z.coerce.number().int().positive().default(7),

  // Development Seeding
  SEED_ADMIN_EMAIL: z.string().email().default('admin@pulsecare.local'),
  SEED_ADMIN_PASSWORD: z.string().min(8).default('AdminSecurePassword123!'),
  SEED_FORCE_RESET: z.preprocess((val) => {
    if (typeof val === 'string') return val.toLowerCase() === 'true';
    return Boolean(val);
  }, z.boolean().default(false))
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('\n======================================================');
  console.error(' [CRITICAL ERROR] ENVIRONMENT VARIABLE VALIDATION FAILED');
  console.error('======================================================');
  console.error('The following environment variables are missing or invalid:');
  
  for (const issue of parsed.error.issues) {
    const field = issue.path.join('.');
    console.error(`  - ${field}: ${issue.message}`);
  }
  
  console.error('\nPlease check your backend/.env file and compare it against backend/.env.example');
  console.error('======================================================\n');
  process.exit(1);
}

export const env = parsed.data;
export default env;
