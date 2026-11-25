import swaggerUi from 'swagger-ui-express';
import env from '../config/env.js';

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'PulseCare Hospital Telemetry & IoT API',
    version: '1.0.0',
    description: 'High-reliability REST & WebSocket API specification for hospital physiological vital signs telemetry, NEWS2 alerting, and clinical data governance.',
    contact: {
      name: 'PulseCare Clinical Systems Team',
      email: 'clinical@pulsecare.dev'
    }
  },
  servers: [
    {
      url: `http://localhost:${env.PORT || 5000}`,
      description: 'Local Telemetry Gateway Server'
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      },
      deviceHmac: {
        type: 'apiKey',
        in: 'header',
        name: 'X-Signature',
        description: 'HMAC-SHA256 device signature calculated with provisioned device key'
      }
    },
    schemas: {
      HealthReading: {
        type: 'object',
        properties: {
          seq: { type: 'integer', example: 1042 },
          ts: { type: 'string', format: 'date-time' },
          heartRate: { type: 'integer', example: 74 },
          spo2: { type: 'integer', example: 98 },
          temperatureC: { type: 'number', example: 37.1 },
          fingerDetected: { type: 'boolean', example: true },
          signalQuality: { type: 'integer', example: 96 }
        }
      },
      Alert: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          type: { type: 'string', enum: ['HR_HIGH', 'HR_LOW', 'SPO2_LOW', 'TEMP_HIGH', 'TEMP_LOW', 'TREND_HR', 'DEVICE_DISCONNECTED', 'INVALID_DATA'] },
          severity: { type: 'string', enum: ['info', 'warning', 'critical'] },
          value: { type: 'number' },
          triggeredAt: { type: 'string', format: 'date-time' },
          resolvedAt: { type: 'string', format: 'date-time', nullable: true }
        }
      }
    }
  },
  paths: {
    '/api/health': {
      get: {
        summary: 'System Liveness Health Probe',
        responses: { 200: { description: 'Server is healthy' } }
      }
    },
    '/api/health/ready': {
      get: {
        summary: 'Kubernetes Container Readiness Probe',
        responses: { 200: { description: 'Ready to receive traffic' }, 503: { description: 'Database disconnected' } }
      }
    },
    '/api/auth/login': {
      post: {
        summary: 'Authenticate clinician or patient',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string' }
                }
              }
            }
          }
        },
        responses: { 200: { description: 'Login successful with JWT access token' } }
      }
    },
    '/api/alerts': {
      get: {
        summary: 'Query active or historical telemetry alarms',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['open', 'acknowledged', 'resolved', 'all'] } },
          { name: 'severity', in: 'query', schema: { type: 'string', enum: ['info', 'warning', 'critical'] } }
        ],
        responses: { 200: { description: 'List of alerts' } }
      }
    },
    '/api/sessions/{sessionId}/report.pdf': {
      get: {
        summary: 'Generate and stream clinical PDF telemetry report',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'sessionId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Application/pdf file stream' } }
      }
    },
    '/api/admin/users': {
      get: {
        summary: 'Admin user directory management',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Paginated user list' } }
      }
    },
    '/api/admin/system/status': {
      get: {
        summary: 'System health, socket connections, and retention status',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'System health metrics' } }
      }
    }
  }
};

/**
 * Setup Swagger documentation route on Express app
 */
export function setupSwagger(app) {
  const isEnabled = env.NODE_ENV !== 'production' || env.ENABLE_SWAGGER;
  if (!isEnabled) {
    app.get('/api/docs', (_req, res) => {
      res.status(403).json({ success: false, error: 'API Documentation disabled in production.' });
    });
    return;
  }

  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'PulseCare Hospital API Docs'
  }));

  console.log('[Swagger] OpenAPI Interactive Explorer mounted at /api/docs');
}

export default { openApiSpec, setupSwagger };
