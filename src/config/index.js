const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const config = {
  // Server Configuration
  server: {
    port: parseInt(process.env.PORT, 10) || 3000,
    env: process.env.NODE_ENV || 'development',
  },

  // Master Auth0 Tenant Configuration (M2M Only)
  auth0: {
    master: {
      domain: process.env.MASTER_AUTH0_DOMAIN,
      clientId: process.env.MASTER_AUTH0_CLIENT_ID,
      clientSecret: process.env.MASTER_AUTH0_CLIENT_SECRET,
      audience: process.env.MASTER_AUTH0_AUDIENCE,
      managementApiAudience: process.env.AUTH0_MANAGEMENT_API_AUDIENCE,
      managementApiScope: process.env.AUTH0_MANAGEMENT_API_SCOPE || 'read:users create:users update:users delete:users read:clients create:clients update:clients delete:clients read:tenant_settings update:tenant_settings',
    },
  },

  // JWT Configuration
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },

  // Rate Limiting Configuration
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 900000, // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
  },

  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'combined',
  },

  // CORS Configuration
  cors: {
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['http://localhost:3000'],
    credentials: process.env.CORS_CREDENTIALS === 'true',
  },

  // Security Configuration
  security: {
    helmetEnabled: process.env.HELMET_ENABLED !== 'false',
    compressionEnabled: process.env.COMPRESSION_ENABLED !== 'false',
  },

  // Database Configuration
  database: {
    url: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'true',
  },

  // Redis Configuration
  redis: {
    url: process.env.REDIS_URL,
    ttl: parseInt(process.env.REDIS_TTL, 10) || 3600,
  },

  // Health Check Configuration
  healthCheck: {
    enabled: process.env.HEALTH_CHECK_ENABLED !== 'false',
    metricsEnabled: process.env.METRICS_ENABLED === 'true',
  },

  // Seat Management Configuration
  seats: {
    defaultLimit: parseInt(process.env.DEFAULT_SEAT_LIMIT, 10) || 10,
    maxLimit: parseInt(process.env.MAX_SEAT_LIMIT, 10) || 1000,
  },

  // Auth0 Tenant Creation Settings
  tenantDefaults: {
    region: process.env.DEFAULT_TENANT_REGION || 'us',
    environment: process.env.DEFAULT_TENANT_ENVIRONMENT || 'development',
  },

  // API Documentation
  docs: {
    enabled: process.env.API_DOCS_ENABLED !== 'false',
    path: process.env.API_DOCS_PATH || '/docs',
  },

  // Error Handling
  errors: {
    detailedErrors: process.env.DETAILED_ERRORS === 'true',
    stackTraceEnabled: process.env.STACK_TRACE_ENABLED === 'true',
  },

  // Session Configuration
  session: {
    secret: process.env.SESSION_SECRET,
    maxAge: parseInt(process.env.SESSION_MAX_AGE, 10) || 86400000, // 24 hours
  },

  // Webhook Configuration
  webhook: {
    secret: process.env.WEBHOOK_SECRET,
    enabled: process.env.WEBHOOK_ENABLED === 'true',
  },

  // Feature Flags
  features: {
    tenantCreation: process.env.ENABLE_TENANT_CREATION !== 'false',
    userManagement: process.env.ENABLE_USER_MANAGEMENT !== 'false',
    seatManagement: process.env.ENABLE_SEAT_MANAGEMENT !== 'false',
    auditLogging: process.env.ENABLE_AUDIT_LOGGING !== 'false',
  },

  // Development Settings
  development: {
    debugMode: process.env.DEBUG_MODE === 'true',
    mockAuth0Api: process.env.MOCK_AUTH0_API === 'true',
  },
};

// Validation function to ensure required environment variables are set
const validateConfig = () => {
  const baseRequired = ['JWT_SECRET'];
  const auth0Required = [
    'MASTER_AUTH0_DOMAIN',
    'MASTER_AUTH0_CLIENT_ID',
    'MASTER_AUTH0_CLIENT_SECRET',
    'MASTER_AUTH0_AUDIENCE',
  ];

  const isMock = process.env.MOCK_AUTH0_API === 'true';
  const requiredVars = isMock ? baseRequired : baseRequired.concat(auth0Required);

  const missingVars = requiredVars.filter((varName) => !process.env[varName]);

  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }
};

// Validate configuration on load
if (config.server.env !== 'test') {
  validateConfig();
}

module.exports = config;