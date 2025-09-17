const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const config = require('./config');
const logger = require('./utils/logger');
const ErrorHandler = require('./middleware/errorHandler');
const routes = require('./routes');

// Initialize global error handlers
ErrorHandler.initialize();

const app = express();

// Trust proxy (for accurate IP addresses behind load balancers)
app.set('trust proxy', 1);

// Security middleware
if (config.security.helmetEnabled) {
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }));
}

// CORS configuration
app.use(cors({
  origin: config.cors.origin,
  credentials: config.cors.credentials,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// Compression middleware
if (config.security.compressionEnabled) {
  app.use(compression());
}

// Body parsing middleware
app.use(express.json({ 
  limit: '10mb',
  strict: true,
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb',
}));

// Request ID middleware (for tracking requests)
app.use((req, res, next) => {
  req.id = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  res.setHeader('X-Request-ID', req.id);
  next();
});

// Request logging middleware
app.use(logger.logRequest);

// Rate limiting middleware
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests from this IP, please try again later.',
      statusCode: 429,
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use user ID if authenticated, otherwise IP
    return req.user?.sub || req.ip;
  },
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path.startsWith('/api/health') || req.path.startsWith('/api/version');
  },
});

app.use('/api', limiter);

// API Routes
app.use('/api', routes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      name: 'Auth0 Multi-Tenancy Management API',
      version: process.env.npm_package_version || '1.0.0',
      description: 'A proxy API for managing Auth0 tenants and users with seat-based licensing',
      status: 'operational',
      timestamp: new Date().toISOString(),
      endpoints: {
        api: '/api',
        health: '/api/health',
        documentation: config.docs.enabled ? config.docs.path : null,
      },
    },
    message: 'Welcome to Auth0 Proxy API',
  });
});

// API Documentation (if enabled)
if (config.docs.enabled) {
  app.get(config.docs.path, (req, res) => {
    res.json({
      success: true,
      data: {
        name: 'Auth0 Multi-Tenancy Management API Documentation',
        version: process.env.npm_package_version || '1.0.0',
        baseUrl: `${req.protocol}://${req.get('host')}/api`,
        endpoints: {
          tenants: {
            description: 'Tenant management endpoints (Master Admin only)',
            routes: {
              'GET /api/tenants': 'List all tenants',
              'POST /api/tenants': 'Create a new tenant',
              'GET /api/tenants/:tenantId': 'Get tenant details',
              'PUT /api/tenants/:tenantId': 'Update tenant',
              'DELETE /api/tenants/:tenantId': 'Delete tenant',
              'GET /api/tenants/:tenantId/users': 'List users in tenant',
              'POST /api/tenants/:tenantId/users': 'Create user in tenant',
            },
          },
          users: {
            description: 'User management endpoints',
            routes: {
              'GET /api/users': 'List users in your tenant',
              'POST /api/users': 'Create a new user',
              'GET /api/users/:userId': 'Get user details',
              'PUT /api/users/:userId': 'Update user',
              'DELETE /api/users/:userId': 'Delete user',
              'GET /api/users/:userId/roles': 'Get user roles',
              'PUT /api/users/:userId/roles': 'Update user roles',
              'GET /api/users/me': 'Get your profile',
              'PUT /api/users/me': 'Update your profile',
            },
          },
          health: {
            description: 'Health and status endpoints',
            routes: {
              'GET /api/health': 'Basic health check',
              'GET /api/health/detailed': 'Detailed health check (Master Admin)',
              'GET /api/status': 'System status (Master Admin)',
              'GET /api/version': 'Version information',
            },
          },
        },
        authentication: {
          type: 'Bearer Token (JWT)',
          header: 'Authorization: Bearer <token>',
          description: 'JWT tokens from Auth0 tenants are required for most endpoints',
        },
        examples: {
          createTenant: {
            method: 'POST',
            url: '/api/tenants',
            headers: {
              'Authorization': 'Bearer <master_admin_jwt>',
              'Content-Type': 'application/json',
            },
            body: {
              name: 'Acme Corp',
              domain: 'acme-corp',
              seatLimit: 50,
              plan: 'premium',
            },
          },
          createUser: {
            method: 'POST',
            url: '/api/users',
            headers: {
              'Authorization': 'Bearer <tenant_admin_jwt>',
              'Content-Type': 'application/json',
            },
            body: {
              email: 'user@example.com',
              name: 'John Doe',
              roles: ['user'],
            },
          },
        },
      },
      message: 'API Documentation',
    });
  });
}

// 404 handler for unknown routes (Express 5: avoid '*' wildcard)
app.use(ErrorHandler.notFound());

// Global error handling middleware
app.use(ErrorHandler.handle());

// Graceful shutdown handling
const gracefulShutdown = (signal) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  
  const server = app.get('server');
  if (server) {
    server.close((err) => {
      if (err) {
        logger.error('Error during server shutdown:', err);
        process.exit(1);
      }
      
      logger.info('Server closed successfully');
      process.exit(0);
    });
    
    // Force shutdown after 30 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 30000);
  } else {
    process.exit(0);
  }
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
const PORT = config.server.port;
const server = app.listen(PORT, () => {
  logger.info(`Auth0 Proxy API server started`, {
    port: PORT,
    environment: config.server.env,
    version: process.env.npm_package_version || '1.0.0',
    nodeVersion: process.version,
  });
  
  console.log(`🚀 Auth0 Proxy API is running on port ${PORT}`);
  console.log(`📚 Environment: ${config.server.env}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
  if (config.docs.enabled) {
    console.log(`📖 Documentation: http://localhost:${PORT}${config.docs.path}`);
  }
});

// Store server reference for graceful shutdown
app.set('server', server);

module.exports = app;