const request = require('supertest');
const app = require('../../../src/app');
const JWTHelper = require('../../helpers/jwtHelper');
const MockAuth0 = require('../../helpers/mockAuth0');

// Mock the logger to avoid console output during tests
jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  logRequest: jest.fn((req, res, next) => next()),
}));

describe('Health Endpoints', () => {
  let server;
  let mockAuth0;

  beforeAll(() => {
    // Start the server for testing
    server = app.listen(0); // Use random port
  });

  afterAll(async () => {
    // Close the server
    if (server) {
      await new Promise((resolve) => {
        server.close(resolve);
      });
    }
  });

  beforeEach(() => {
    mockAuth0 = new MockAuth0();
  });

  afterEach(() => {
    MockAuth0.clearMocks();
  });

  describe('GET /api/health', () => {
    test('should return basic health status without authentication', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toEqual({
        status: 'healthy',
        timestamp: expect.any(String),
        uptime: expect.any(Number),
        version: expect.any(String),
        environment: 'test',
        services: {
          api: 'operational',
          auth0: expect.any(String),
        },
      });

      expect(new Date(response.body.timestamp)).toBeValidDate();
      expect(response.body.uptime).toBeGreaterThan(0);
    });

    test('should return degraded status when Auth0 service fails', async () => {
      // Mock Auth0 service to fail
      jest.doMock('../../../src/services/auth0Service', () => {
        return jest.fn().mockImplementation(() => {
          throw new Error('Auth0 connection failed');
        });
      });

      const response = await request(app)
        .get('/api/health')
        .expect(503);

      expect(response.body.status).toBe('degraded');
      expect(response.body.services.auth0).toBe('degraded');
    });
  });

  describe('GET /api/health/detailed', () => {
    test('should return detailed health status for master admin', async () => {
      const masterAdminToken = JWTHelper.generateMasterAdminToken();
      mockAuth0.mockBasicAuth0Operations();

      const response = await request(app)
        .get('/api/health/detailed')
        .set('Authorization', JWTHelper.generateAuthHeader(masterAdminToken))
        .expect(200);

      expect(response.body).toEqual({
        status: 'healthy',
        timestamp: expect.any(String),
        uptime: expect.any(Number),
        version: expect.any(String),
        environment: 'test',
        system: {
          nodeVersion: expect.any(String),
          platform: expect.any(String),
          arch: expect.any(String),
          memory: {
            used: expect.any(Number),
            total: expect.any(Number),
            external: expect.any(Number),
          },
          cpu: {
            loadAverage: expect.any(Array),
          },
        },
        services: expect.objectContaining({
          auth0: expect.objectContaining({
            status: expect.any(String),
            responseTime: expect.any(Number),
            lastCheck: expect.any(String),
          }),
        }),
        checks: expect.arrayContaining([
          expect.objectContaining({
            name: expect.any(String),
            status: expect.stringMatching(/^(pass|fail)$/),
          }),
        ]),
        responseTime: expect.any(Number),
      });
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .get('/api/health/detailed')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('MISSING_TOKEN');
    });

    test('should require master admin role', async () => {
      const regularUserToken = JWTHelper.generateUserToken();

      const response = await request(app)
        .get('/api/health/detailed')
        .set('Authorization', JWTHelper.generateAuthHeader(regularUserToken))
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTHORIZATION_ERROR');
    });

    test('should return degraded status when services fail', async () => {
      const masterAdminToken = JWTHelper.generateMasterAdminToken();
      
      // Mock Auth0 to fail
      mockAuth0.mockManagementTokenError();

      const response = await request(app)
        .get('/api/health/detailed')
        .set('Authorization', JWTHelper.generateAuthHeader(masterAdminToken))
        .expect(503);

      expect(response.body.status).toBe('degraded');
      expect(response.body.services.auth0.status).toBe('degraded');
      expect(response.body.checks).toContainEqual(
        expect.objectContaining({
          name: 'Auth0 Management API',
          status: 'fail',
          error: expect.any(String),
        })
      );
    });
  });

  describe('GET /api/status', () => {
    test('should return system status for master admin', async () => {
      const masterAdminToken = JWTHelper.generateMasterAdminToken();
      mockAuth0.mockBasicAuth0Operations();

      const response = await request(app)
        .get('/api/status')
        .set('Authorization', JWTHelper.generateAuthHeader(masterAdminToken))
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: expect.objectContaining({
          timestamp: expect.any(String),
          uptime: expect.any(Number),
          version: expect.any(String),
          environment: 'test',
          system: expect.objectContaining({
            nodeVersion: expect.any(String),
            platform: expect.any(String),
            memory: expect.objectContaining({
              used: expect.any(Number),
              total: expect.any(Number),
            }),
          }),
          configuration: expect.objectContaining({
            port: expect.any(Number),
            logLevel: expect.any(String),
          }),
          features: expect.any(Object),
          statistics: expect.any(Object),
        }),
        message: 'System status retrieved successfully',
      });
    });

    test('should require master admin authentication', async () => {
      const tenantAdminToken = JWTHelper.generateTenantAdminToken();

      const response = await request(app)
        .get('/api/status')
        .set('Authorization', JWTHelper.generateAuthHeader(tenantAdminToken))
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTHORIZATION_ERROR');
    });
  });

  describe('GET /api/version', () => {
    test('should return version information without authentication', async () => {
      const response = await request(app)
        .get('/api/version')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: expect.objectContaining({
          version: expect.any(String),
          name: 'Auth0 Multi-Tenancy Management API',
          description: expect.any(String),
          environment: 'test',
          nodeVersion: expect.any(String),
          buildDate: expect.any(String),
          commit: expect.any(String),
        }),
        message: 'Version information retrieved successfully',
      });
    });
  });

  describe('GET /api/metrics', () => {
    test('should return metrics for master admin when enabled', async () => {
      // Mock metrics enabled
      jest.doMock('../../../src/config', () => ({
        ...require('../../../src/config'),
        healthCheck: {
          metricsEnabled: true,
        },
      }));

      const masterAdminToken = JWTHelper.generateMasterAdminToken();

      const response = await request(app)
        .get('/api/metrics')
        .set('Authorization', JWTHelper.generateAuthHeader(masterAdminToken))
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: expect.objectContaining({
          timestamp: expect.any(String),
          uptime: expect.any(Number),
          memory: expect.any(Object),
          cpu: expect.any(Object),
          eventLoop: expect.any(Object),
          requests: expect.any(Object),
        }),
        message: 'Metrics retrieved successfully',
      });
    });

    test('should return 404 when metrics are disabled', async () => {
      const masterAdminToken = JWTHelper.generateMasterAdminToken();

      const response = await request(app)
        .get('/api/metrics')
        .set('Authorization', JWTHelper.generateAuthHeader(masterAdminToken))
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('METRICS_DISABLED');
    });

    test('should require master admin authentication', async () => {
      const regularUserToken = JWTHelper.generateUserToken();

      const response = await request(app)
        .get('/api/metrics')
        .set('Authorization', JWTHelper.generateAuthHeader(regularUserToken))
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/health/test', () => {
    test('should run health tests for master admin', async () => {
      const masterAdminToken = JWTHelper.generateMasterAdminToken();
      mockAuth0.mockBasicAuth0Operations();

      const response = await request(app)
        .post('/api/health/test')
        .set('Authorization', JWTHelper.generateAuthHeader(masterAdminToken))
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: expect.objectContaining({
          timestamp: expect.any(String),
          tests: expect.arrayContaining([
            expect.objectContaining({
              name: 'Basic API Response',
              status: 'pass',
              duration: expect.any(Number),
            }),
            expect.objectContaining({
              name: 'Auth0 Connectivity',
              status: expect.stringMatching(/^(pass|fail)$/),
            }),
            expect.objectContaining({
              name: 'Service Instantiation',
              status: expect.stringMatching(/^(pass|fail)$/),
            }),
          ]),
        }),
        message: expect.any(String),
      });
    });

    test('should return 500 when some tests fail', async () => {
      const masterAdminToken = JWTHelper.generateMasterAdminToken();
      
      // Mock Auth0 to fail
      mockAuth0.mockManagementTokenError();

      const response = await request(app)
        .post('/api/health/test')
        .set('Authorization', JWTHelper.generateAuthHeader(masterAdminToken))
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.data.tests).toContainEqual(
        expect.objectContaining({
          name: 'Auth0 Connectivity',
          status: 'fail',
          error: expect.any(String),
        })
      );
    });

    test('should require master admin authentication', async () => {
      const tenantAdminToken = JWTHelper.generateTenantAdminToken();

      const response = await request(app)
        .post('/api/health/test')
        .set('Authorization', JWTHelper.generateAuthHeader(tenantAdminToken))
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Response Headers', () => {
    test('should include request ID in response headers', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.headers['x-request-id']).toBeDefined();
      expect(response.headers['x-request-id']).toMatch(/^req_\d+_[a-z0-9]+$/);
    });

    test('should include CORS headers', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('should handle service initialization errors gracefully', async () => {
      // Mock service to throw error during initialization
      jest.doMock('../../../src/services/auth0Service', () => {
        return jest.fn().mockImplementation(() => {
          throw new Error('Service initialization failed');
        });
      });

      const response = await request(app)
        .get('/api/health')
        .expect(503);

      expect(response.body.status).toBe('degraded');
    });
  });

  describe('Performance', () => {
    test('should respond to health check within reasonable time', async () => {
      const startTime = Date.now();
      
      await request(app)
        .get('/api/health')
        .expect(200);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(1000); // Should respond within 1 second
    });

    test('should handle concurrent health check requests', async () => {
      const promises = Array(10).fill().map(() => 
        request(app)
          .get('/api/health')
          .expect(200)
      );

      const responses = await Promise.all(promises);
      
      responses.forEach(response => {
        expect(response.body.status).toBe('healthy');
      });
    });
  });

  describe('Content Type', () => {
    test('should return JSON content type', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });
  });

  describe('HTTP Methods', () => {
    test('should only allow GET for basic health endpoint', async () => {
      await request(app)
        .post('/api/health')
        .expect(404);

      await request(app)
        .put('/api/health')
        .expect(404);

      await request(app)
        .delete('/api/health')
        .expect(404);
    });

    test('should only allow GET for detailed health endpoint', async () => {
      const masterAdminToken = JWTHelper.generateMasterAdminToken();

      await request(app)
        .post('/api/health/detailed')
        .set('Authorization', JWTHelper.generateAuthHeader(masterAdminToken))
        .expect(404);
    });
  });
});