import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import config from './config/env.js';
import { requestLogger, correlationId } from './middleware/request-logger.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { optionalAuth } from './middleware/authz.js';
import usersRoutes from './routes/users.routes.js';
import rolesRoutes from './routes/roles.routes.js';
import userRolesRoutes from './routes/userRoles.routes.js';
import auth0Service from './services/auth0.service.js';

/**
 * Express application setup with security middleware and routes
 */
const app = express();

// Trust proxy for accurate client IP addresses
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (config.cors.allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    const error = new Error(`CORS policy violation: Origin ${origin} not allowed`);
    error.statusCode = 403;
    callback(error);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-ID'],
  exposedHeaders: ['X-Correlation-ID'],
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests from this IP, please try again later',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// Request parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging and correlation ID
app.use(correlationId);
app.use(requestLogger);

// Swagger documentation
const swaggerSpec = {
  openapi: '3.0.0',
  info: {
    title: 'Auth0 Management API Proxy',
    version: '1.0.0',
    description: 'Production-ready Node.js REST API for Auth0 user and role management via Management API v2',
    contact: {
      name: 'API Support',
    },
  },
  servers: [
    {
      url: `http://localhost:${config.api.port}`,
      description: 'Development server',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Auth0 Management API JWT token with proper audience and client_id',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              code: {
                type: 'string',
                description: 'Error code',
              },
              message: {
                type: 'string',
                description: 'Error message',
              },
              details: {
                type: 'object',
                description: 'Additional error details',
              },
              correlationId: {
                type: 'string',
                description: 'Request correlation ID for tracing',
              },
            },
            required: ['code', 'message', 'correlationId'],
          },
        },
      },
    },
  },
  tags: [
    {
      name: 'Users',
      description: 'Auth0 user management operations',
    },
    {
      name: 'Roles',
      description: 'Auth0 role management operations',
    },
    {
      name: 'User Roles',
      description: 'User-role assignment operations',
    },
    {
      name: 'Health',
      description: 'API health and status',
    },
  ],
};

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Auth0 Management API Proxy - Documentation',
}));

// Health check endpoint
app.get('/health', optionalAuth, async (req, res) => {
  const correlationId = req.correlationId;
  
  try {
    const auth0Health = await auth0Service.getHealth();
    const uptime = process.uptime();
    
    const health = {
      status: 'ok',
      uptime: Math.floor(uptime),
      version: '1.0.0',
      now: new Date().toISOString(),
      correlationId,
      services: {
        auth0: auth0Health,
      },
    };

    // If Auth0 service is unhealthy, return 503
    if (auth0Health.status === 'unhealthy') {
      return res.status(503).json({
        ...health,
        status: 'degraded',
      });
    }

    res.json(health);
  } catch (error) {
    res.status(503).json({
      status: 'error',
      uptime: Math.floor(process.uptime()),
      version: '1.0.0',
      now: new Date().toISOString(),
      correlationId,
      error: error.message,
    });
  }
});

// API routes
app.use('/users', usersRoutes);
app.use('/roles', rolesRoutes);
app.use('/users', userRolesRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Auth0 Management API Proxy',
    version: '1.0.0',
    description: 'Production-ready Node.js REST API for Auth0 user management',
    endpoints: {
      health: '/health',
      docs: '/docs',
      users: '/users',
      roles: '/roles',
      userRoles: '/users/:id/roles',
    },
    correlationId: req.correlationId,
  });
});

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

export default app;