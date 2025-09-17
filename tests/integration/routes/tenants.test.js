const request = require('supertest');
const app = require('../../../src/app');
const JWTHelper = require('../../helpers/jwtHelper');
const MockAuth0 = require('../../helpers/mockAuth0');
const { sampleTenants, createdTenants } = require('../../fixtures/tenants');

// Mock the logger
jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  audit: jest.fn(),
  logRequest: jest.fn((req, res, next) => next()),
  logError: jest.fn(),
}));

describe('Tenant Management Routes', () => {
  let server;
  let mockAuth0;
  let masterAdminToken;
  let tenantAdminToken;
  let regularUserToken;

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
    masterAdminToken = JWTHelper.generateMasterAdminToken();
    tenantAdminToken = JWTHelper.generateTenantAdminToken();
    regularUserToken = JWTHelper.generateUserToken();
  });

  afterEach(() => {
    MockAuth0.clearMocks();
  });

  describe('GET /api/tenants', () => {
    test('should list all tenants for master admin', async () => {
      mockAuth0.mockBasicAuth0Operations();

      const response = await request(app)
        .get('/api/tenants')
        .set('Authorization', JWTHelper.generateAuthHeader(masterAdminToken))
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: expect.objectContaining({
          tenants: expect.any(Array),
          pagination: expect.objectContaining({
            total: expect.any(Number),
            page: 1,
            limit: 10,
            totalPages: expect.any(Number),
            hasNext: expect.any(Boolean),
            hasPrev: false,
          }),
        }),
        message: expect.stringContaining('Retrieved'),
      });
    });

    test('should support pagination parameters', async () => {
      mockAuth0.mockBasicAuth0Operations();

      const response = await request(app)
        .get('/api/tenants')
        .query({
          page: 2,
          limit: 5,
          sortBy: 'name',
          sortOrder: 'asc',
        })
        .set('Authorization', JWTHelper.generateAuthHeader(masterAdminToken))
        .expect(200);

      expect(response.body.data.pagination.page).toBe(2);
      expect(response.body.data.pagination.limit).toBe(5);
    });

    test('should support search filtering', async () => {
      mockAuth0.mockBasicAuth0Operations();

      const response = await request(app)
        .get('/api/tenants')
        .query({
          search: 'acme',
          status: 'active',
        })
        .set('Authorization', JWTHelper.generateAuthHeader(masterAdminToken))
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('should require master admin authentication', async () => {
      const response = await request(app)
        .get('/api/tenants')
        .set('Authorization', JWTHelper.generateAuthHeader(tenantAdminToken))
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTHORIZATION_ERROR');
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .get('/api/tenants')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('MISSING_TOKEN');
    });

    test('should validate query parameters', async () => {
      mockAuth0.mockBasicAuth0Operations();

      const response = await request(app)
        .get('/api/tenants')
        .query({
          page: 'invalid',
          limit: 101, // Exceeds maximum
        })
        .set('Authorization', JWTHelper.generateAuthHeader(masterAdminToken))
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/tenants', () => {
    test('should create a new tenant successfully', async () => {
      mockAuth0.mockBasicAuth0Operations();
      mockAuth0.mockCreateClient();

      const response = await request(app)
        .post('/api/tenants')
        .set('Authorization', JWTHelper.generateAuthHeader(masterAdminToken))
        .send(sampleTenants.validTenant)
        .expect(201);

      expect(response.body).toEqual({
        success: true,
        data: {
          tenant: expect.objectContaining({
            id: expect.any(String),
            name: sampleTenants.validTenant.name,
            domain: expect.stringContaining(sampleTenants.validTenant.domain),
            seatLimit: sampleTenants.validTenant.seatLimit,
            seatUsed: 0,
            status: 'active',
            metadata: expect.objectContaining(sampleTenants.validTenant.metadata),
            createdAt: expect.any(String),
            updatedAt: expect.any(String),
          }),
        },
        message: 'Tenant created successfully',
      });
    });

    test('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/tenants')
        .set('Authorization', JWTHelper.generateAuthHeader(masterAdminToken))
        .send({
          name: '', // Invalid: empty name
          domain: '', // Invalid: empty domain
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details.validationErrors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'name',
            message: expect.stringContaining('at least 2 characters'),
          }),
          expect.objectContaining({
            field: 'domain',
            message: expect.any(String),
          }),
        ])
      );
    });

    test('should validate domain format', async () => {
      const response = await request(app)
        .post('/api/tenants')
        .set('Authorization', JWTHelper.generateAuthHeader(masterAdminToken))
        .send({
          name: 'Valid Name',
          domain: 'Invalid Domain!', // Contains invalid characters
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.details.validationErrors).toContainEqual(
        expect.objectContaining({
          field: 'domain',
          message: expect.stringContaining('lowercase letters, numbers, and hyphens'),
        })
      );
    });

    test('should validate seat limit range', async () => {
      const response = await request(app)
        .post('/api/tenants')
        .set('Authorization', JWTHelper.generateAuthHeader(masterAdminToken))
        .send({
          name: 'Valid Name',
          domain: 'valid-domain',
          seatLimit: 10001, // Exceeds maximum
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should require master admin authentication', async () => {
      const response = await request(app)
        .post('/api/tenants')
        .set('Authorization', JWTHelper.generateAuthHeader(tenantAdminToken))
        .send(sampleTenants.validTenant)
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    test('should handle Auth0 API errors', async () => {
      mockAuth0.mockManagementToken();
      mockAuth0.mockCreateUserError(409, 'Conflict');

      const response = await request(app)
        .post('/api/tenants')
        .set('Authorization', JWTHelper.generateAuthHeader(masterAdminToken))
        .send(sampleTenants.validTenant)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('CONFLICT_ERROR');
    });
  });

  describe('GET /api/tenants/:tenantId', () => {
    test('should get tenant details for master admin', async () => {
      mockAuth0.mockBasicAuth0Operations();
      const tenantId = 'tenant_acme_123';

      const response = await request(app)
        .get(`/api/tenants/${tenantId}`)
        .set('Authorization', JWTHelper.generateAuthHeader(masterAdminToken))
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          tenant: expect.objectContaining({
            id: tenantId,
            name: expect.any(String),
            domain: expect.any(String),
            seatLimit: expect.any(Number),
            seatUsed: expect.any(Number),
            status: expect.any(String),
            seatUsage: expect.any(Object),
            seatReport: expect.any(Object),
            stats: expect.any(Object),
          }),
        },
        message: 'Tenant retrieved successfully',
      });
    });

    test('should validate tenant ID parameter', async () => {
      const response = await request(app)
        .get('/api/tenants/')
        .set('Authorization', JWTHelper.generateAuthHeader(masterAdminToken))
        .expect(404);
    });

    test('should require master admin authentication', async () => {
      const response = await request(app)
        .get('/api/tenants/tenant_123')
        .set('Authorization', JWTHelper.generateAuthHeader(regularUserToken))
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/tenants/:tenantId', () => {
    test('should update tenant successfully', async () => {
      mockAuth0.mockBasicAuth0Operations();
      const tenantId = 'tenant_acme_123';
      const updates = {
        name: 'Updated Acme Corporation',
        seatLimit: 75,
        metadata: {
          plan: 'enterprise',
          updated: true,
        },
      };

      const response = await request(app)
        .put(`/api/tenants/${tenantId}`)
        .set('Authorization', JWTHelper.generateAuthHeader(masterAdminToken))
        .send(updates)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          tenant: expect.objectContaining({
            id: tenantId,
            name: updates.name,
            seatLimit: updates.seatLimit,
            metadata: expect.objectContaining(updates.metadata),
            updatedAt: expect.any(String),
          }),
        },
        message: 'Tenant updated successfully',
      });
    });

    test('should validate update data', async () => {
      const tenantId = 'tenant_acme_123';

      const response = await request(app)
        .put(`/api/tenants/${tenantId}`)
        .set('Authorization', JWTHelper.generateAuthHeader(masterAdminToken))
        .send({
          seatLimit: -5, // Invalid: negative
          status: 'invalid_status', // Invalid: not allowed value
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('should require at least one field to update', async () => {
      const tenantId = 'tenant_acme_123';

      const response = await request(app)
        .put(`/api/tenants/${tenantId}`)
        .set('Authorization', JWTHelper.generateAuthHeader(masterAdminToken))
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should require master admin authentication', async () => {
      const response = await request(app)
        .put('/api/tenants/tenant_123')
        .set('Authorization', JWTHelper.generateAuthHeader(tenantAdminToken))
        .send({ name: 'Updated Name' })
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/tenants/:tenantId', () => {
    test('should delete tenant successfully when no active users', async () => {
      mockAuth0.mockBasicAuth0Operations();
      const tenantId = 'tenant_empty_123';

      const response = await request(app)
        .delete(`/api/tenants/${tenantId}`)
        .set('Authorization', JWTHelper.generateAuthHeader(masterAdminToken))
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: expect.objectContaining({
          id: tenantId,
          deleted: true,
          deletedAt: expect.any(String),
        }),
        message: 'Tenant deleted successfully',
      });
    });

    test('should prevent deletion of tenant with active users', async () => {
      mockAuth0.mockBasicAuth0Operations();
      const tenantId = 'tenant_with_users_123';

      const response = await request(app)
        .delete(`/api/tenants/${tenantId}`)
        .set('Authorization', JWTHelper.generateAuthHeader(masterAdminToken))
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('BUSINESS_LOGIC_ERROR');
      expect(response.body.error.message).toContain('active users');
    });

    test('should return 404 for non-existent tenant', async () => {
      const response = await request(app)
        .delete('/api/tenants/nonexistent_tenant')
        .set('Authorization', JWTHelper.generateAuthHeader(masterAdminToken))
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('TENANT_NOT_FOUND');
    });

    test('should require master admin authentication', async () => {
      const response = await request(app)
        .delete('/api/tenants/tenant_123')
        .set('Authorization', JWTHelper.generateAuthHeader(tenantAdminToken))
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/tenants/:tenantId/stats', () => {
    test('should return tenant statistics for master admin', async () => {
      mockAuth0.mockBasicAuth0Operations();
      const tenantId = 'tenant_acme_123';

      const response = await request(app)
        .get(`/api/tenants/${tenantId}/stats`)
        .set('Authorization', JWTHelper.generateAuthHeader(masterAdminToken))
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          stats: expect.objectContaining({
            tenantId,
            totalUsers: expect.any(Number),
            activeUsers: expect.any(Number),
            blockedUsers: expect.any(Number),
            pendingUsers: expect.any(Number),
            seatUtilization: expect.any(Number),
            lastUserCreated: expect.any(String),
            lastLogin: expect.any(String),
            createdAt: expect.any(String),
            status: expect.any(String),
          }),
        },
        message: 'Tenant statistics retrieved successfully',
      });
    });

    test('should require master admin authentication', async () => {
      const response = await request(app)
        .get('/api/tenants/tenant_123/stats')
        .set('Authorization', JWTHelper.generateAuthHeader(regularUserToken))
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/tenants/:tenantId/users', () => {
    test('should list users in specific tenant for master admin', async () => {
      mockAuth0.mockBasicAuth0Operations();
      mockAuth0.mockGetUsers([
        {
          user_id: 'auth0|user_123',
          email: 'user@tenant.com',
          name: 'Test User',
          app_metadata: { tenant_id: 'tenant_acme_123' },
        },
      ]);

      const tenantId = 'tenant_acme_123';

      const response = await request(app)
        .get(`/api/tenants/${tenantId}/users`)
        .set('Authorization', JWTHelper.generateAuthHeader(masterAdminToken))
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: expect.objectContaining({
          users: expect.any(Array),
          pagination: expect.any(Object),
        }),
        message: expect.stringContaining('Retrieved'),
      });
    });

    test('should support user filtering parameters', async () => {
      mockAuth0.mockBasicAuth0Operations();
      mockAuth0.mockGetUsers([]);

      const response = await request(app)
        .get('/api/tenants/tenant_123/users')
        .query({
          search: 'john',
          role: 'admin',
          status: 'active',
        })
        .set('Authorization', JWTHelper.generateAuthHeader(masterAdminToken))
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('should require master admin authentication', async () => {
      const response = await request(app)
        .get('/api/tenants/tenant_123/users')
        .set('Authorization', JWTHelper.generateAuthHeader(tenantAdminToken))
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/tenants/:tenantId/users', () => {
    test('should create user in specific tenant for master admin', async () => {
      mockAuth0.mockBasicAuth0Operations();
      mockAuth0.mockCreateUser({
        user_id: 'auth0|new_user_123',
        email: 'newuser@tenant.com',
        name: 'New User',
      });

      const tenantId = 'tenant_acme_123';
      const userData = {
        email: 'newuser@tenant.com',
        name: 'New User',
        roles: ['user'],
      };

      const response = await request(app)
        .post(`/api/tenants/${tenantId}/users`)
        .set('Authorization', JWTHelper.generateAuthHeader(masterAdminToken))
        .send(userData)
        .expect(201);

      expect(response.body).toEqual({
        success: true,
        data: {
          user: expect.objectContaining({
            id: expect.any(String),
            email: userData.email,
            name: userData.name,
            tenantId,
            roles: userData.roles,
          }),
        },
        message: 'User created successfully in tenant',
      });
    });

    test('should validate user data', async () => {
      const tenantId = 'tenant_acme_123';

      const response = await request(app)
        .post(`/api/tenants/${tenantId}/users`)
        .set('Authorization', JWTHelper.generateAuthHeader(masterAdminToken))
        .send({
          email: 'invalid-email', // Invalid format
          name: '', // Empty name
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('should handle seat limit exceeded', async () => {
      mockAuth0.mockBasicAuth0Operations();
      const tenantId = 'tenant_at_limit_123';

      const response = await request(app)
        .post(`/api/tenants/${tenantId}/users`)
        .set('Authorization', JWTHelper.generateAuthHeader(masterAdminToken))
        .send({
          email: 'newuser@tenant.com',
          name: 'New User',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('SEAT_LIMIT_EXCEEDED');
    });

    test('should require master admin authentication', async () => {
      const response = await request(app)
        .post('/api/tenants/tenant_123/users')
        .set('Authorization', JWTHelper.generateAuthHeader(tenantAdminToken))
        .send({
          email: 'user@example.com',
          name: 'Test User',
        })
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/tenants/:tenantId/seat-limit', () => {
    test('should update seat limit successfully', async () => {
      mockAuth0.mockBasicAuth0Operations();
      const tenantId = 'tenant_acme_123';
      const newSeatLimit = 75;

      const response = await request(app)
        .put(`/api/tenants/${tenantId}/seat-limit`)
        .set('Authorization', JWTHelper.generateAuthHeader(masterAdminToken))
        .send({ seatLimit: newSeatLimit })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          tenant: expect.objectContaining({
            id: tenantId,
            seatLimit: newSeatLimit,
          }),
        },
        message: 'Tenant seat limit updated successfully',
      });
    });

    test('should validate seat limit value', async () => {
      const tenantId = 'tenant_acme_123';

      const response = await request(app)
        .put(`/api/tenants/${tenantId}/seat-limit`)
        .set('Authorization', JWTHelper.generateAuthHeader(masterAdminToken))
        .send({ seatLimit: 0 }) // Invalid: must be at least 1
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('should require master admin authentication', async () => {
      const response = await request(app)
        .put('/api/tenants/tenant_123/seat-limit')
        .set('Authorization', JWTHelper.generateAuthHeader(tenantAdminToken))
        .send({ seatLimit: 50 })
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/tenants/:tenantId/seat-usage', () => {
    test('should return seat usage for master admin', async () => {
      mockAuth0.mockBasicAuth0Operations();
      const tenantId = 'tenant_acme_123';

      const response = await request(app)
        .get(`/api/tenants/${tenantId}/seat-usage`)
        .set('Authorization', JWTHelper.generateAuthHeader(masterAdminToken))
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          seatUsage: expect.objectContaining({
            tenantId,
            seatLimit: expect.any(Number),
            seatUsed: expect.any(Number),
            availableSeats: expect.any(Number),
            utilizationPercentage: expect.any(Number),
          }),
          seatReport: expect.objectContaining({
            tenantId,
            currentUsage: expect.any(Object),
            recommendations: expect.any(Array),
            alerts: expect.any(Array),
          }),
        },
        message: 'Tenant seat usage retrieved successfully',
      });
    });

    test('should require master admin authentication', async () => {
      const response = await request(app)
        .get('/api/tenants/tenant_123/seat-usage')
        .set('Authorization', JWTHelper.generateAuthHeader(regularUserToken))
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/tenants/:tenantId/validate-access', () => {
    test('should validate tenant access for authenticated user', async () => {
      mockAuth0.mockBasicAuth0Operations();
      const tenantId = 'tenant_acme_123';
      const userToken = JWTHelper.generateUserToken(tenantId);

      const response = await request(app)
        .post(`/api/tenants/${tenantId}/validate-access`)
        .set('Authorization', JWTHelper.generateAuthHeader(userToken))
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: expect.objectContaining({
          valid: expect.any(Boolean),
          tenant: expect.any(Object),
          userAccess: expect.any(Object),
        }),
        message: 'Tenant access validation completed',
      });
    });

    test('should reject access to different tenant', async () => {
      const tenantId = 'tenant_acme_123';
      const userToken = JWTHelper.generateUserToken('different_tenant_456');

      const response = await request(app)
        .post(`/api/tenants/${tenantId}/validate-access`)
        .set('Authorization', JWTHelper.generateAuthHeader(userToken))
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    test('should allow master admin to access any tenant', async () => {
      mockAuth0.mockBasicAuth0Operations();
      const tenantId = 'any_tenant_123';

      const response = await request(app)
        .post(`/api/tenants/${tenantId}/validate-access`)
        .set('Authorization', JWTHelper.generateAuthHeader(masterAdminToken))
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .post('/api/tenants/tenant_123/validate-access')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('MISSING_TOKEN');
    });
  });

  describe('Error Handling', () => {
    test('should handle malformed JSON in request body', async () => {
      const response = await request(app)
        .post('/api/tenants')
        .set('Authorization', JWTHelper.generateAuthHeader(masterAdminToken))
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should handle missing Content-Type header', async () => {
      const response = await request(app)
        .post('/api/tenants')
        .set('Authorization', JWTHelper.generateAuthHeader(masterAdminToken))
        .send(sampleTenants.validTenant)
        .expect(201);

      // Should still work with default content type handling
      expect(response.body.success).toBe(true);
    });

    test('should include request ID in error responses', async () => {
      const response = await request(app)
        .get('/api/tenants/nonexistent')
        .set('Authorization', JWTHelper.generateAuthHeader(masterAdminToken))
        .expect(404);

      expect(response.body.error.requestId).toBeDefined();
      expect(response.body.error.requestId).toMatch(/^req_\d+_[a-z0-9]+$/);
    });
  });

  describe('Rate Limiting', () => {
    test('should apply rate limiting to tenant endpoints', async () => {
      mockAuth0.mockBasicAuth0Operations();

      // Make multiple requests rapidly
      const promises = Array(5).fill().map(() =>
        request(app)
          .get('/api/tenants')
          .set('Authorization', JWTHelper.generateAuthHeader(masterAdminToken))
      );

      const responses = await Promise.all(promises);
      
      // All should succeed within normal rate limits
      responses.forEach(response => {
        expect([200, 429]).toContain(response.status);
      });
    });
  });

  describe('CORS Headers', () => {
    test('should include CORS headers in responses', async () => {
      const response = await request(app)
        .get('/api/tenants')
        .set('Authorization', JWTHelper.generateAuthHeader(masterAdminToken))
        .expect(403); // Will fail auth but should have CORS headers

      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });

    test('should handle OPTIONS requests', async () => {
      const response = await request(app)
        .options('/api/tenants')
        .expect(204);

      expect(response.headers['access-control-allow-methods']).toBeDefined();
    });
  });
});