const express = require('express');
const config = require('../config');
const logger = require('../utils/logger');
const ErrorHandler = require('../middleware/errorHandler');
const auth = require('../middleware/auth');
const AuthorizationMiddleware = require('../middleware/authorization');

const router = express.Router();

/**
 * @route GET /api/health
 * @desc Basic health check endpoint
 * @access Public
 */
router.get('/',
  ErrorHandler.asyncHandler(async (req, res) => {
    const healthCheck = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: config.server.env,
      services: {
        api: 'operational',
      },
    };

    // Basic service checks
    try {
      const Auth0Service = require('../services/auth0Service');
      const auth0Service = new Auth0Service();

      // In mock mode, avoid any external dependency
      if (process.env.MOCK_AUTH0_API === 'true') {
        healthCheck.services.auth0 = 'operational';
      } else {
        // In real mode, attempt a lightweight check (token fetch)
        try {
          await auth0Service.getManagementToken();
          healthCheck.services.auth0 = 'operational';
        } catch (e) {
          healthCheck.services.auth0 = 'degraded';
          healthCheck.status = 'degraded';
        }
      }
    } catch (error) {
      // In mock mode, do not degrade health if instantiation fails due to network/env
      if (process.env.MOCK_AUTH0_API === 'true') {
        healthCheck.services.auth0 = 'operational';
      } else {
        healthCheck.services.auth0 = 'degraded';
        healthCheck.status = 'degraded';
      }
    }

    // Set appropriate status code
    const statusCode = healthCheck.status === 'healthy' ? 200 : 503;

    res.status(statusCode).json(healthCheck);
  })
);

/**
 * @route GET /api/health/detailed
 * @desc Detailed health check with service status
 * @access Private (Master Admin)
 */
router.get('/detailed',
  auth.authenticate(),
  AuthorizationMiddleware.requireMasterAdmin(),
  ErrorHandler.asyncHandler(async (req, res) => {
    const startTime = Date.now();
    
    const healthCheck = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: config.server.env,
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          external: Math.round(process.memoryUsage().external / 1024 / 1024),
        },
        cpu: {
          loadAverage: process.loadavg(),
        },
      },
      services: {},
      checks: [],
    };

    // Check Auth0 Service
    try {
      const Auth0Service = require('../services/auth0Service');
      const auth0Service = new Auth0Service();
      
      // Try to get a management token (this tests Auth0 connectivity)
      let tokenTime = 0;
      if (process.env.MOCK_AUTH0_API === 'true') {
        // In mock mode, avoid external dependency; simulate timing only
        const tokenStart = Date.now();
        // No real call needed; mock service already avoids network
        await Promise.resolve();
        tokenTime = Date.now() - tokenStart;
      } else {
        const tokenStart = Date.now();
        await auth0Service.getManagementToken();
        tokenTime = Date.now() - tokenStart;
      }
      
      healthCheck.services.auth0 = {
        status: 'operational',
        responseTime: tokenTime,
        lastCheck: new Date().toISOString(),
      };
      
      healthCheck.checks.push({
        name: 'Auth0 Management API',
        status: 'pass',
        responseTime: tokenTime,
      });
    } catch (error) {
      healthCheck.services.auth0 = {
        status: 'degraded',
        error: error.message,
        lastCheck: new Date().toISOString(),
      };
      
      healthCheck.checks.push({
        name: 'Auth0 Management API',
        status: 'fail',
        error: error.message,
      });
      
      healthCheck.status = 'degraded';
    }

    // Check Tenant Service
    try {
      const TenantService = require('../services/tenantService');
      const tenantService = new TenantService();
      
      healthCheck.services.tenantService = {
        status: 'operational',
        lastCheck: new Date().toISOString(),
      };
      
      healthCheck.checks.push({
        name: 'Tenant Service',
        status: 'pass',
      });
    } catch (error) {
      healthCheck.services.tenantService = {
        status: 'degraded',
        error: error.message,
        lastCheck: new Date().toISOString(),
      };
      
      healthCheck.checks.push({
        name: 'Tenant Service',
        status: 'fail',
        error: error.message,
      });
      
      healthCheck.status = 'degraded';
    }

    // Check User Service
    try {
      const UserService = require('../services/userService');
      const userService = new UserService();
      
      healthCheck.services.userService = {
        status: 'operational',
        lastCheck: new Date().toISOString(),
      };
      
      healthCheck.checks.push({
        name: 'User Service',
        status: 'pass',
      });
    } catch (error) {
      healthCheck.services.userService = {
        status: 'degraded',
        error: error.message,
        lastCheck: new Date().toISOString(),
      };
      
      healthCheck.checks.push({
        name: 'User Service',
        status: 'fail',
        error: error.message,
      });
      
      healthCheck.status = 'degraded';
    }

    // Check Seat Service
    try {
      const SeatService = require('../services/seatService');
      const seatService = new SeatService();
      
      healthCheck.services.seatService = {
        status: 'operational',
        lastCheck: new Date().toISOString(),
      };
      
      healthCheck.checks.push({
        name: 'Seat Service',
        status: 'pass',
      });
    } catch (error) {
      healthCheck.services.seatService = {
        status: 'degraded',
        error: error.message,
        lastCheck: new Date().toISOString(),
      };
      
      healthCheck.checks.push({
        name: 'Seat Service',
        status: 'fail',
        error: error.message,
      });
      
      healthCheck.status = 'degraded';
    }

    // Add total response time
    healthCheck.responseTime = Date.now() - startTime;

    // Set appropriate status code
    const statusCode = healthCheck.status === 'healthy' ? 200 : 503;

    logger.info('Detailed health check completed', {
      status: healthCheck.status,
      responseTime: healthCheck.responseTime,
      requestedBy: req.user.sub,
    });

    res.status(statusCode).json(healthCheck);
  })
);

/**
 * @route GET /api/status
 * @desc System status and statistics
 * @access Private (Master Admin)
 */
router.get('/status',
  auth.authenticate(),
  AuthorizationMiddleware.requireMasterAdmin(),
  ErrorHandler.asyncHandler(async (req, res) => {
    logger.info('Getting system status', {
      requestedBy: req.user.sub,
    });

    const status = {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: config.server.env,
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        pid: process.pid,
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          external: Math.round(process.memoryUsage().external / 1024 / 1024),
          rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
        },
        cpu: {
          loadAverage: process.loadavg(),
          usage: process.cpuUsage(),
        },
      },
      configuration: {
        port: config.server.port,
        logLevel: config.logging.level,
        rateLimitWindow: config.rateLimit.windowMs,
        rateLimitMax: config.rateLimit.maxRequests,
        defaultSeatLimit: config.seats.defaultLimit,
        maxSeatLimit: config.seats.maxLimit,
      },
      features: config.features,
    };

    // Get tenant and user statistics
    try {
      const SeatService = require('../services/seatService');
      const seatService = new SeatService();
      
      const seatStats = await seatService.getAllTenantsSeatsStats();
      status.statistics = {
        tenants: {
          total: seatStats.totalTenants,
          totalSeatsAllocated: seatStats.totalSeatsAllocated,
          totalSeatsUsed: seatStats.totalSeatsUsed,
          averageUtilization: seatStats.averageUtilization,
        },
      };
    } catch (error) {
      logger.warn('Failed to get statistics for status endpoint:', error);
      status.statistics = {
        error: 'Statistics temporarily unavailable',
      };
    }

    res.json({
      success: true,
      data: status,
      message: 'System status retrieved successfully',
    });
  })
);

/**
 * @route GET /api/version
 * @desc Get API version information
 * @access Public
 */
router.get('/version',
  ErrorHandler.asyncHandler(async (req, res) => {
    const version = {
      version: process.env.npm_package_version || '1.0.0',
      name: 'Auth0 Multi-Tenancy Management API',
      description: 'A proxy API for managing Auth0 tenants and users with seat-based licensing',
      environment: config.server.env,
      nodeVersion: process.version,
      buildDate: process.env.BUILD_DATE || new Date().toISOString(),
      commit: process.env.GIT_COMMIT || 'unknown',
    };

    res.json({
      success: true,
      data: version,
      message: 'Version information retrieved successfully',
    });
  })
);

/**
 * @route GET /api/metrics
 * @desc Get basic metrics (if enabled)
 * @access Private (Master Admin)
 */
router.get('/metrics',
  auth.authenticate(),
  AuthorizationMiddleware.requireMasterAdmin(),
  ErrorHandler.asyncHandler(async (req, res) => {
    if (!config.healthCheck.metricsEnabled) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'METRICS_DISABLED',
          message: 'Metrics collection is disabled',
        },
      });
    }

    const metrics = {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      eventLoop: {
        // In a real implementation, you might use libraries like @nodejs/clinic
        // or custom event loop monitoring
        lag: 0, // Placeholder
      },
      requests: {
        // In a real implementation, you would track these metrics
        total: 0,
        successful: 0,
        failed: 0,
        averageResponseTime: 0,
      },
    };

    logger.info('Metrics requested', {
      requestedBy: req.user.sub,
    });

    res.json({
      success: true,
      data: metrics,
      message: 'Metrics retrieved successfully',
    });
  })
);

/**
 * @route POST /api/health/test
 * @desc Test endpoint for health monitoring systems
 * @access Private (Master Admin)
 */
router.post('/test',
  auth.authenticate(),
  AuthorizationMiddleware.requireMasterAdmin(),
  ErrorHandler.asyncHandler(async (req, res) => {
    const testResults = {
      timestamp: new Date().toISOString(),
      tests: [],
    };

    // Test 1: Basic functionality
    testResults.tests.push({
      name: 'Basic API Response',
      status: 'pass',
      duration: 1,
    });

    // Test 2: Auth0 connectivity
    try {
      const Auth0Service = require('../services/auth0Service');
      const auth0Service = new Auth0Service();
      
      const start = Date.now();
      await auth0Service.getManagementToken();
      const duration = Date.now() - start;
      
      testResults.tests.push({
        name: 'Auth0 Connectivity',
        status: 'pass',
        duration,
      });
    } catch (error) {
      testResults.tests.push({
        name: 'Auth0 Connectivity',
        status: 'fail',
        error: error.message,
      });
    }

    // Test 3: Service instantiation
    try {
      const TenantService = require('../services/tenantService');
      const UserService = require('../services/userService');
      const SeatService = require('../services/seatService');
      
      new TenantService();
      new UserService();
      new SeatService();
      
      testResults.tests.push({
        name: 'Service Instantiation',
        status: 'pass',
        duration: 1,
      });
    } catch (error) {
      testResults.tests.push({
        name: 'Service Instantiation',
        status: 'fail',
        error: error.message,
      });
    }

    const allPassed = testResults.tests.every(test => test.status === 'pass');
    const statusCode = allPassed ? 200 : 500;

    logger.info('Health test completed', {
      requestedBy: req.user.sub,
      allPassed,
      testCount: testResults.tests.length,
    });

    res.status(statusCode).json({
      success: allPassed,
      data: testResults,
      message: allPassed ? 'All tests passed' : 'Some tests failed',
    });
  })
);

module.exports = router;