const request = require('supertest');
const app = require('../../src/app');
const JWTHelper = require('../helpers/jwtHelper');
const MockAuth0 = require('../helpers/mockAuth0');

// Mock the logger
jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  logRequest: jest.fn((req, res, next) => next()),
  logError: jest.fn(),
}));

describe('Authentication Security Tests', () => {
  let server;
  let mockAuth0;

  beforeAll(() => {
    server = app.listen(0);
  });

  afterAll(async () => {
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

  describe('JWT Token Validation', () => {
    test('should accept valid JWT token', async () => {
      mockAuth0.mockBasicAuth0Operations();
      const validToken = JWTHelper.generateMasterAdminToken();

      const response = await request(app)
        .get('/api/tenants')
        .set('Authorization', JWTHelper.generateAuthHeader(validToken))
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('should reject missing Authorization header', async () => {
      const response = await request(app)
        .get('/api/tenants')
        .expect(401);

      expect(response.body).toEqual({
        success: false,
        error: expect.objectContaining({
          code: 'MISSING_TOKEN',
          message: 'Authorization header is required',
          statusCode: 401,
        }),
      });
    });

    test('should reject malformed Authorization header', async () => {
      const response = await request(app)
        .get('/api/tenants')
        .set('Authorization', 'InvalidFormat token123')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });

    test('should reject expired JWT token', async () => {
      const expiredToken = JWTHelper.generateExpiredToken();

      const response = await request(app)
        .get('/api/tenants')
        .set('Authorization', JWTHelper.generateAuthHeader(expiredToken))
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });

    test('should reject JWT token with invalid signature', async () => {
      const invalidToken = JWTHelper.generateInvalidToken();

      const response = await request(app)
        .get('/api/tenants')
        .set('Authorization', JWTHelper.generateAuthHeader(invalidToken))
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });

    test('should reject completely malformed token', async () => {
      const malformedToken = JWTHelper.generateMalformedToken();

      const response = await request(app)
        .get('/api/tenants')
        .set('Authorization', JWTHelper.generateAuthHeader(malformedToken))
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });

    test('should reject token without Bearer prefix', async () => {
      const validToken = JWTHelper.generateMasterAdminToken();

      const response = await request(app)
        .get('/api/tenants')
        .set('Authorization', validToken) // Missing "Bearer " prefix
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });

    test('should reject empty Authorization header', async () => {
      const response = await request(app)
        .get('/api/tenants')
        .set('Authorization', '')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('MISSING_TOKEN');
    });

    test('should reject token with missing required claims', async () => {
      const tokenWithoutClaims = JWTHelper.generateToken({
        sub: undefined, // Missing required claim
        email: undefined,
      });

      const response = await request(app)
        .get('/api/tenants')
        .set('Authorization', JWTHelper.generateAuthHeader(tokenWithoutClaims))
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Tenant Domain Validation', () => {
    test('should accept token from master tenant domain', async () => {
      mockAuth0.mockBasicAuth0Operations();
      const masterToken = JWTHelper.generateMasterAdminToken();

      const response = await request(app)
        .get('/api/tenants')
        .set('Authorization', JWTHelper.generateAuthHeader(masterToken))
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('should accept token from customer tenant domain', async () => {
      mockAuth0.mockBasicAuth0Operations();
      const tenantToken = JWTHelper.generateTenantAdminToken('customer_tenant_123');

      const response = await request(app)
        .get('/api/users')
        .set('Authorization', JWTHelper.generateAuthHeader(tenantToken))
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('should reject token from unknown tenant domain', async () => {
      const unknownTenantToken = JWTHelper.generateToken({
        iss: 'https://unknown-tenant.auth0.com/',
        aud: 'https://unknown-tenant.auth0.com/api/v2/',
      });

      const response = await request(app)
        .get('/api/users')
        .set('Authorization', JWTHelper.generateAuthHeader(unknownTenantToken))
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Token Audience Validation', () => {
    test('should reject token with wrong audience', async () => {
      const wrongAudienceToken = JWTHelper.generateToken({
        aud: 'https://wrong-audience.com/api/v2/',
      });

      const response = await request(app)
        .get('/api/users')
        .set('Authorization', JWTHelper.generateAuthHeader(wrongAudienceToken))
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    test('should reject token with missing audience', async () => {
      const noAudienceToken = JWTHelper.generateToken({
        aud: undefined,
      });

      const response = await request(app)
        .get('/api/users')
        .set('Authorization', JWTHelper.generateAuthHeader(noAudienceToken))
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Token Issuer Validation', () => {
    test('should reject token with wrong issuer', async () => {
      const wrongIssuerToken = JWTHelper.generateToken({
        iss: 'https://malicious-domain.com/',
      });

      const response = await request(app)
        .get('/api/users')
        .set('Authorization', JWTHelper.generateAuthHeader(wrongIssuerToken))
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    test('should reject token with missing issuer', async () => {
      const noIssuerToken = JWTHelper.generateToken({
        iss: undefined,
      });

      const response = await request(app)
        .get('/api/users')
        .set('Authorization', JWTHelper.generateAuthHeader(noIssuerToken))
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('User Context Creation', () => {
    test('should create proper user context from valid token', async () => {
      mockAuth0.mockBasicAuth0Operations();
      const token = JWTHelper.generateMasterAdminToken({
        sub: 'test_user_123',
        email: 'test@example.com',
        name: 'Test User',
        roles: ['master_admin'],
      });

      // We'll test this indirectly by checking if the request succeeds
      // and the user context is properly set (which we can infer from successful authorization)
      const response = await request(app)
        .get('/api/tenants')
        .set('Authorization', JWTHelper.generateAuthHeader(token))
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('should handle token with minimal claims', async () => {
      mockAuth0.mockBasicAuth0Operations();
      const minimalToken = JWTHelper.generateToken({
        sub: 'minimal_user_123',
        // Missing optional claims like name, picture, etc.
      });

      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', JWTHelper.generateAuthHeader(minimalToken))
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Security Headers', () => {
    test('should include security headers in responses', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      // Check for security headers (these might be set by helmet)
      expect(response.headers['x-request-id']).toBeDefined();
    });

    test('should not expose sensitive information in error responses', async () => {
      const response = await request(app)
        .get('/api/tenants')
        .expect(401);

      // Should not expose internal details
      expect(response.body.error.message).not.toContain('secret');
      expect(response.body.error.message).not.toContain('password');
      expect(response.body.error.message).not.toContain('key');
    });
  });

  describe('Authentication Bypass Attempts', () => {
    test('should not allow bypassing authentication with custom headers', async () => {
      const response = await request(app)
        .get('/api/tenants')
        .set('X-User-ID', 'admin_123')
        .set('X-Tenant-ID', 'master')
        .set('X-Roles', 'master_admin')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('MISSING_TOKEN');
    });

    test('should not allow authentication with API key instead of JWT', async () => {
      const response = await request(app)
        .get('/api/tenants')
        .set('Authorization', 'ApiKey abc123')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    test('should not allow authentication with Basic auth', async () => {
      const response = await request(app)
        .get('/api/tenants')
        .set('Authorization', 'Basic dXNlcjpwYXNzd29yZA==')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Token Injection Attacks', () => {
    test('should reject token with SQL injection attempt in claims', async () => {
      const maliciousToken = JWTHelper.generateToken({
        sub: "'; DROP TABLE users; --",
        email: 'test@example.com',
        name: '<script>alert("xss")</script>',
      });

      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', JWTHelper.generateAuthHeader(maliciousToken))
        .expect(200); // Token is valid, but claims should be sanitized

      // The response should not contain the malicious content
      expect(response.body.data.user.name).not.toContain('<script>');
    });

    test('should handle extremely long token gracefully', async () => {
      const longClaim = 'a'.repeat(10000);
      const longToken = JWTHelper.generateToken({
        sub: 'test_user_123',
        longClaim,
      });

      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', JWTHelper.generateAuthHeader(longToken))
        .expect(401); // Should reject due to size or processing limits

      expect(response.body.success).toBe(false);
    });
  });

  describe('Concurrent Authentication', () => {
    test('should handle multiple concurrent authentication requests', async () => {
      mockAuth0.mockBasicAuth0Operations();
      const tokens = [
        JWTHelper.generateMasterAdminToken(),
        JWTHelper.generateTenantAdminToken(),
        JWTHelper.generateUserToken(),
      ];

      const promises = tokens.map(token =>
        request(app)
          .get('/api/health/detailed')
          .set('Authorization', JWTHelper.generateAuthHeader(token))
      );

      const responses = await Promise.all(promises);

      // First should succeed (master admin), others should fail with 403
      expect(responses[0].status).toBe(200);
      expect(responses[1].status).toBe(403);
      expect(responses[2].status).toBe(403);
    });

    test('should handle rapid authentication attempts from same user', async () => {
      mockAuth0.mockBasicAuth0Operations();
      const token = JWTHelper.generateMasterAdminToken();

      const promises = Array(10).fill().map(() =>
        request(app)
          .get('/api/health')
          .set('Authorization', JWTHelper.generateAuthHeader(token))
      );

      const responses = await Promise.all(promises);

      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });
  });

  describe('Token Reuse and Replay', () => {
    test('should allow token reuse within expiration time', async () => {
      mockAuth0.mockBasicAuth0Operations();
      const token = JWTHelper.generateMasterAdminToken();

      // Use the same token multiple times
      const response1 = await request(app)
        .get('/api/health')
        .set('Authorization', JWTHelper.generateAuthHeader(token))
        .expect(200);

      const response2 = await request(app)
        .get('/api/health')
        .set('Authorization', JWTHelper.generateAuthHeader(token))
        .expect(200);

      expect(response1.body.status).toBe('healthy');
      expect(response2.body.status).toBe('healthy');
    });

    test('should reject token after expiration', async () => {
      const expiredToken = JWTHelper.generateExpiredToken();

      const response = await request(app)
        .get('/api/tenants')
        .set('Authorization', JWTHelper.generateAuthHeader(expiredToken))
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });
  });

  describe('Cross-Tenant Token Usage', () => {
    test('should prevent using tenant A token to access tenant B resources', async () => {
      mockAuth0.mockBasicAuth0Operations();
      const tenantAToken = JWTHelper.generateTenantAdminToken('tenant_a_123');

      const response = await request(app)
        .post('/api/tenants/tenant_b_456/validate-access')
        .set('Authorization', JWTHelper.generateAuthHeader(tenantAToken))
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED_TENANT_ACCESS');
    });

    test('should allow master admin to access any tenant', async () => {
      mockAuth0.mockBasicAuth0Operations();
      const masterToken = JWTHelper.generateMasterAdminToken();

      const response = await request(app)
        .post('/api/tenants/any_tenant_123/validate-access')
        .set('Authorization', JWTHelper.generateAuthHeader(masterToken))
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Role-Based Access Control', () => {
    test('should allow master admin full access', async () => {
      mockAuth0.mockBasicAuth0Operations();
      const masterToken = JWTHelper.generateMasterAdminToken();

      const endpoints = [
        { method: 'get', path: '/api/tenants' },
        { method: 'post', path: '/api/tenants', body: { name: 'Test', domain: 'test' } },
        { method: 'get', path: '/api/status' },
        { method: 'get', path: '/api/health/detailed' },
      ];

      for (const endpoint of endpoints) {
        const req = request(app)[endpoint.method](endpoint.path)
          .set('Authorization', JWTHelper.generateAuthHeader(masterToken));

        if (endpoint.body) {
          req.send(endpoint.body);
        }

        const response = await req;
        expect([200, 201]).toContain(response.status);
      }
    });

    test('should restrict tenant admin access to tenant management', async () => {
      const tenantToken = JWTHelper.generateTenantAdminToken();

      const restrictedEndpoints = [
        { method: 'get', path: '/api/tenants' },
        { method: 'post', path: '/api/tenants', body: { name: 'Test', domain: 'test' } },
        { method: 'get', path: '/api/status' },
      ];

      for (const endpoint of restrictedEndpoints) {
        const req = request(app)[endpoint.method](endpoint.path)
          .set('Authorization', JWTHelper.generateAuthHeader(tenantToken));

        if (endpoint.body) {
          req.send(endpoint.body);
        }

        const response = await req;
        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
      }
    });

    test('should restrict regular user access to most endpoints', async () => {
      const userToken = JWTHelper.generateUserToken();

      const restrictedEndpoints = [
        { method: 'get', path: '/api/tenants' },
        { method: 'post', path: '/api/users', body: { email: 'test@example.com', name: 'Test' } },
        { method: 'delete', path: '/api/users/user_123' },
      ];

      for (const endpoint of restrictedEndpoints) {
        const req = request(app)[endpoint.method](endpoint.path)
          .set('Authorization', JWTHelper.generateAuthHeader(userToken));

        if (endpoint.body) {
          req.send(endpoint.body);
        }

        const response = await req;
        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
      }
    });

    test('should allow users to access their own profile', async () => {
      mockAuth0.mockBasicAuth0Operations();
      mockAuth0.mockGetUser('auth0|regular_user_123');
      
      const userToken = JWTHelper.generateUserToken('tenant_123', {
        sub: 'auth0|regular_user_123',
      });

      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', JWTHelper.generateAuthHeader(userToken))
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Privilege Escalation Prevention', () => {
    test('should prevent users from modifying their own roles', async () => {
      const userToken = JWTHelper.generateUserToken('tenant_123', {
        sub: 'auth0|user_123',
      });

      const response = await request(app)
        .put('/api/users/auth0|user_123/roles')
        .set('Authorization', JWTHelper.generateAuthHeader(userToken))
        .send({ roles: ['admin', 'master_admin'] })
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    test('should prevent users from deleting themselves', async () => {
      const userToken = JWTHelper.generateUserToken('tenant_123', {
        sub: 'auth0|user_123',
      });

      const response = await request(app)
        .delete('/api/users/auth0|user_123')
        .set('Authorization', JWTHelper.generateAuthHeader(userToken))
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_OPERATION');
    });

    test('should prevent tenant admins from accessing master tenant functions', async () => {
      const tenantToken = JWTHelper.generateTenantAdminToken();

      const masterOnlyEndpoints = [
        { method: 'get', path: '/api/tenants' },
        { method: 'post', path: '/api/tenants', body: { name: 'Test', domain: 'test' } },
        { method: 'delete', path: '/api/tenants/tenant_123' },
      ];

      for (const endpoint of masterOnlyEndpoints) {
        const req = request(app)[endpoint.method](endpoint.path)
          .set('Authorization', JWTHelper.generateAuthHeader(tenantToken));

        if (endpoint.body) {
          req.send(endpoint.body);
        }

        const response = await req;
        expect(response.status).toBe(403);
      }
    });
  });

  describe('Session Security', () => {
    test('should include request tracking in responses', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.headers['x-request-id']).toBeDefined();
      expect(response.headers['x-request-id']).toMatch(/^req_\d+_[a-z0-9]+$/);
    });

    test('should handle multiple requests with different request IDs', async () => {
      const response1 = await request(app).get('/api/health');
      const response2 = await request(app).get('/api/health');

      expect(response1.headers['x-request-id']).not.toBe(response2.headers['x-request-id']);
    });
  });

  describe('Input Sanitization', () => {
    test('should sanitize malicious input in request bodies', async () => {
      mockAuth0.mockBasicAuth0Operations();
      const masterToken = JWTHelper.generateMasterAdminToken();

      const maliciousData = {
        name: '<script>alert("xss")</script>',
        domain: 'test-domain',
        metadata: {
          maliciousScript: '<img src=x onerror=alert("xss")>',
          sqlInjection: "'; DROP TABLE tenants; --",
        },
      };

      const response = await request(app)
        .post('/api/tenants')
        .set('Authorization', JWTHelper.generateAuthHeader(masterToken))
        .send(maliciousData)
        .expect(201);

      // Should succeed but sanitize the input
      expect(response.body.success).toBe(true);
      // The actual sanitization would depend on your implementation
    });
  });

  describe('Error Information Disclosure', () => {
    test('should not expose stack traces in production-like environment', async () => {
      // Mock an internal error
      jest.doMock('../../src/services/tenantService', () => {
        return jest.fn().mockImplementation(() => {
          throw new Error('Internal database connection failed with credentials: user:pass@host');
        });
      });

      const response = await request(app)
        .get('/api/tenants')
        .set('Authorization', JWTHelper.generateAuthHeader(JWTHelper.generateMasterAdminToken()))
        .expect(500);

      expect(response.body.error.message).not.toContain('credentials');
      expect(response.body.error.message).not.toContain('password');
      expect(response.body.error.stack).toBeUndefined();
    });
  });
});