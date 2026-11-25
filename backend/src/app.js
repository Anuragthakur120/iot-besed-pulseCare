import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import hpp from 'hpp';
import mongoSanitize from 'express-mongo-sanitize';
import crypto from 'node:crypto';
import pino from 'pino';
import { pinoHttp } from 'pino-http';
import env from './config/env.js';
import apiRouter from './routes/index.js';
import { notFound, errorHandler } from './middleware/index.js';

const app = express();

// Initialize Pino Logger with sensitive data redaction
const logger = pino({
  level: env.NODE_ENV === 'development' ? 'debug' : 'info',
  redact: [
    'req.headers.authorization',
    'req.headers.cookie',
    'req.body.password',
    'req.body.currentPassword',
    'req.body.newPassword',
    'req.body.token',
    'req.body.tokenHash'
  ],
  transport:
    env.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname'
          }
        }
      : undefined
});

// Configure CORS Allowlist from Environment
const allowedOrigins = env.CLIENT_ORIGIN.split(',').map((origin) => origin.trim());

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. mobile apps, curl, server-to-server, ESP32 nodes)
    if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      return callback(null, true);
    }
    return callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'X-Device-Id',
    'X-Signature',
    'X-Request-Id'
  ]
};

// 1. Request ID Tracking
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
});

// 2. Security HTTP Headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  })
);

// 3. Cross-Origin Resource Sharing
app.use(cors(corsOptions));

// 4. Body Parsers with 100kb payload limit for defense against payload overflow
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// 5. Data Sanitization against NoSQL query injection & HTTP Parameter Pollution
app.use(mongoSanitize());
app.use(hpp());

// 6. Cookie Parser
app.use(cookieParser());

// 7. HTTP Request Logging with Pino (never logs passwords or tokens)
app.use(
  pinoHttp({
    logger,
    autoLogging: {
      ignore: (req) => req.url === '/api/health'
    }
  })
);

// 8. Global Rate Limiter (skip health checks)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    data: null,
    error: 'Too many requests from this IP, please try again after 15 minutes.'
  },
  skip: (req) => req.path === '/api/health'
});

app.use(globalLimiter);

import { setupSwagger } from './utils/swagger.js';

// 9. Mount Core API Routes under /api
app.use('/api', apiRouter);

// 9.1 OpenAPI / Swagger UI (/api/docs)
setupSwagger(app);

// Root route
app.get('/', (_req, res) => {
  res.json({
    service: 'PulseCare Telemetry & Patient Monitoring API',
    version: '1.0.0',
    health: '/api/health'
  });
});

// 10. Error Handling Middleware
app.use(notFound);
app.use(errorHandler);

export default app;
