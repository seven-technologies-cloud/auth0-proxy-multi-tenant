import dotenv from 'dotenv';

dotenv.config();

/**
 * Environment configuration with validation and defaults
 */
const config = {
  // Auth0 Configuration
  auth0: {
    domain: process.env.AUTH0_DOMAIN,
    mgmtClientId: process.env.AUTH0_MGMT_CLIENT_ID,
    mgmtClientSecret: process.env.AUTH0_MGMT_CLIENT_SECRET,
    audience: process.env.AUTH0_AUDIENCE || (process.env.AUTH0_DOMAIN ? `https://${process.env.AUTH0_DOMAIN}/api/v2/` : null),
    issuer: process.env.AUTH0_DOMAIN ? `https://${process.env.AUTH0_DOMAIN}/` : null,
  },

  // Security Configuration
  security: {
    mgmtClientAllowlist: process.env.MGMT_CLIENT_ALLOWLIST?.split(',').map(id => id.trim()) || [],
  },

  // API Configuration
  api: {
    port: parseInt(process.env.API_PORT) || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
  },

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
    max: parseInt(process.env.RATE_LIMIT_MAX) || 60,
  },

  // CORS Configuration
  cors: {
    allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',').map(origin => origin.trim()) || ['http://localhost:3000'],
  },

  // Idempotent Create Configuration
  idempotentCreateMode: process.env.IDEMPOTENT_CREATE_MODE || 'return', // 'return' or 'conflict'
};

/**
 * Validate required environment variables
 */
function validateConfig() {
  const required = [
    'AUTH0_DOMAIN',
    'AUTH0_MGMT_CLIENT_ID',
    'AUTH0_MGMT_CLIENT_SECRET',
    'MGMT_CLIENT_ALLOWLIST',
  ];

  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  if (!config.auth0.domain.includes('.auth0.com')) {
    throw new Error('AUTH0_DOMAIN must be a valid Auth0 domain');
  }

  if (config.security.mgmtClientAllowlist.length === 0) {
    throw new Error('MGMT_CLIENT_ALLOWLIST must contain at least one client ID');
  }

  if (!['return', 'conflict'].includes(config.idempotentCreateMode)) {
    throw new Error('IDEMPOTENT_CREATE_MODE must be either "return" or "conflict"');
  }
}

// Validate configuration on import
validateConfig();

export default config;