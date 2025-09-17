const request = require('supertest');
const app = require('../../../src/app');
const JWTHelper = require('../../helpers/jwtHelper');
const MockAuth0 = require('../../helpers/mockAuth0');
const { sampleTenants, sampleUsers } = require('../../fixtures/tenants');

// Mock the logger
jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  audit: jest.fn(),
  logRequest: jest.fn((req, res, next) => next()),
  logError: jest.fn(),
}));

describe('Tenant Lifecycle Workflow Tests', () => {
  let server;
  let mockAuth0;
  let masterAdminToken;
  let createdTenantId;
  let createdUserId;

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
    createdTenantId = null;
    createdUserId = null;
  });

  afterEach(() => {
    MockAuth0.clearMocks();
  });

  describe('Complete Tenant Management Workflow', () => {
    test('should complete full tenant lifecycle: create → read → update → manage users → delete', async () => {
      // Setup mocks for all operations
      mockAuth0.mockBasicAuth0Operations();
      mockAuth0.mockCreateClient({
        client_id: 'test_client_123',
        client_secret: 'test_secret_123',
      });
      mockAuth0.mockCreateUser({
        user_id: 'auth0|test_user_123',
        email: 'user@workflow-test.com',
        name: 'Workflow Test User',
      });
      mockAuth0.mockGetUser('auth0|test_user_123');
      mockAuth0.mockDeleteUser('auth0|test_user_123');

      // Step 1: Create a new tenant
      console.log('🏗️  Step 1: Creating tenant...');
      const createTenantResponse = await request(app)
        .post('/api/tenants')
        .set('Authorization', JWTHelper.generateAuthHeader(masterAdminToken))
        .send({
          name: 'Workflow Test Corp',
          domain: 'workflow-test-corp',
          seatLimit: 25,
          plan: 'standard',
          industry: 'technology',
          contactEmail: 'admin@workflow-test.com',
        })
        .expect(201);

      expect(createTenantResponse.body.success).toBe(true);
      createdTenantId = createTenantResponse.body.data.tenant.id;
      console.log(`✅ Tenant created with ID: ${createdTenantId}`);

      // Step 2: Retrieve the created tenant
      console.log('📖 Step 2: Retrieving tenant details...');
      const getTenantResponse = await request(app)
        .get(`/api/tenants/${createdTenantId}`)
        .set('Authorization', JWTHelper.generateAuthHeader(masterAdminToken))
        .expect(200);

      expect(getTenantResponse.body.success).toBe(true);
      expect(getTenantResponse.body.data.tenant.name).toBe('Workflow Test Corp');
      expect(getTenantResponse.body.data.tenant.seatUsed).toBe(0);
      console.log('✅ Tenant details retrieved successfully');

      // Step 3: Update tenant information
      console.log('✏️  Step 3: Updating tenant...');
      const updateTenantResponse = await request(app)
        .put(`/api/tenants/${createdTenantId}`)
        .set('Authorization', JWTHelper.generateAuthHeader(masterAdminToken))
        .send({
          name: 'Updated Workflow Test Corp',
          seatLimit: 50,
          metadata: {
            updated: true,
            workflow: 'test',
          },
        })
        .expect(200);

      expect(updateTenantResponse.body.success).toBe(true);
      expect(updateTenantResponse.body.data.tenant.name).toBe('Updated Workflow Test Corp');
      expect(updateTenantResponse.body.data.tenant.seatLimit).toBe(50);
      console.log('✅ Tenant updated successfully');

      // Step 4: Create a user in the tenant
      console.log('👤 Step 4: Creating user in tenant...');
      const createUserResponse = await request(app)
        .post(`/api/tenants/${createdTenantId}/users`)
        .set('Authorization', JWTHelper.generateAuthHeader(masterAdminToken))
        .send({
          email: 'user@workflow-test.com',
          name: 'Workflow Test User',
          roles: ['user'],
          metadata: {
            department: 'testing',
            workflow: 'test',
          },
        })
        .expect(201);

      expect(createUserResponse.body.success).toBe(true);
      createdUserId = createUserResponse.body.data.user.id;
      console.log(`✅ User created with ID: ${createdUserId}`);

      // Step 5: Verify seat usage increased
      console.log('📊 Step 5: Checking seat usage...');
      const seatUsageResponse = await request(app)
        .get(`/api/tenants/${createdTenantId}/seat-usage`)
        .set('Authorization', JWTHelper.generateAuthHeader(masterAdminToken))
        .expect(200);

      expect(seatUsageResponse.body.success).toBe(true);
      expect(seatUsageResponse.body.data.seatUsage.seatUsed).toBe(1);
      expect(seatUsageResponse.body.data.seatUsage.availableSeats).toBe(49);
      console.log('✅ Seat usage verified');

      // Step 6: List users in the tenant
      console.log('📋 Step 6: Listing tenant users...');
      const listUsersResponse = await request(app)
        .get(`/api/tenants/${createdTenantId}/users`)
        .set('Authorization', JWTHelper.generateAuthHeader(masterAdminToken))
        .expect(200);

      expect(listUsersResponse.body.success).toBe(true);
      expect(listUsersResponse.body.data.users).toHaveLength(1);
      console.log('✅ Users listed successfully');

      // Step 7: Update the user
      console.log('✏️  Step 7: Updating user...');
      const updateUserResponse = await request(app)
        .put(`/api/users/${createdUserId}`)
        .set('Authorization', JWTHelper.generateAuthHeader(masterAdminToken))
        .send({
          name: 'Updated Workflow Test User',
          metadata: {
            department: 'testing',
            title: 'Senior Tester',
            updated: true,
          },
        })
        .expect(200);

      expect(updateUserResponse.body.success).toBe(true);
      expect(updateUserResponse.body.data.user.name).toBe('Updated Workflow Test User');
      console.log('✅ User updated successfully');

      // Step 8: Get tenant statistics
      console.log('📈 Step 8: Getting tenant statistics...');
      const statsResponse = await request(app)
        .get(`/api/tenants/${createdTenantId}/stats`)
        .set('Authorization', JWTHelper.generateAuthHeader(masterAdminToken))
        .expect(200);

      expect(statsResponse.body.success).toBe(true);
      expect(statsResponse.body.data.stats.totalUsers).toBeGreaterThan(0);
      console.log('✅ Statistics retrieved successfully');

      // Step 9: Delete the user (to free up seat)
      console.log('🗑️  Step 9: Deleting user...');
      const deleteUserResponse = await request(app)
        .delete(`/api/users/${createdUserId}`)
        .set('Authorization', JWTHelper.generateAuthHeader(masterAdminToken))
        .expect(200);

      expect(deleteUserResponse.body.success).toBe(true);
      expect(deleteUserResponse.body.data.deleted).toBe(true);
      console.log('✅ User deleted successfully');

      // Step 10: Verify seat was released
      console.log('📊 Step 10: Verifying seat release...');
      const finalSeatUsageResponse = await request(app)
        .get(`/api/tenants/${createdTenantId}/seat-usage`)
        .set('Authorization', JWTHelper.generateAuthHeader(masterAdminToken))
        .expect(200);

      expect(finalSeatUsageResponse.body.success).toBe(true);
      expect(finalSeatUsageResponse.body.data.seatUsage.seatUsed).toBe(0);
      console.log('✅ Seat released successfully');

      // Step 11: Delete the tenant
      console.log('🗑️  Step 11: Deleting tenant...');
      const deleteTenantResponse = await request(app)
        .delete(`/api/tenants/${createdTenantId}`)
        .set('Authorization', JWTHelper.generateAuthHeader(masterAdminToken))
        .expect(200);

      expect(deleteTenantResponse.body.success).toBe(true);
      expect(deleteTenantResponse.body.data.deleted).toBe(true);
      console.log('✅ Tenant deleted successfully');

      console.log('🎉 Complete tenant lifecycle workflow completed successfully!');
    });

    test('should handle workflow with seat limit constraints', async () => {
      mockAuth0.mockBasicAuth0Operations();
      mockAuth0.mockCreateClient();
      
      // Create multiple user mocks
      for (let i = 1; i <= 12; i++) {
        mockAuth0.mockCreateUser({
          user_id: `auth0|user_${i}`,
          email: `user${i}@test.com`,
          name: `User ${i}`,
        });
      }

      // Step 1: Create tenant with small seat limit
      const createTenantResponse = await request(app)
        .post('/api/tenants')
        .set('Authorization', JWTHelper.generateAuthHeader(masterAdminToken))
        .send({
          name: 'Small Tenant',
          domain: 'small-tenant',
          seatLimit: 10,
        })
        .expect(201);

      createdTenantId = createTenantResponse.body.data.tenant.id;

      // Step 2: Create users up to the limit
      console.log('👥 Creating users up to seat limit...');
      const userCreationPromises = [];
      
      for (let i = 1; i <= 10; i++) {
        userCreationPromises.push(
          request(app)
            .post(`/api/tenants/${createdTenantId}/users`)
            .set('Authorization', JWTHelper.generateAuthHeader(masterAdminToken))
            .send({
              email: `user${i}@small-tenant.com`,
              name: `User ${i}`,
              roles: ['user'],
            })
        );
      }

      const userResponses = await Promise.all(userCreationPromises);
      
      // All 10 should succeed
      userResponses.forEach(response => {
        expect(response.status).toBe(201);
      });

      // Step 3: Try to create 11th user (should fail)
      console.log('🚫 Attempting to exceed seat limit...');
      const exceededResponse = await request(app)
        .post(`/api/tenants/${createdTenantId}/users`)
        .set('Authorization', JWTHelper.generateAuthHeader(masterAdminToken))
        .send({
          email: 'user11@small-tenant.com',
          name: 'User 11',
          roles: ['user'],
        })
        .expect(400);

      expect(exceededResponse.body.success).toBe(false);
      expect(exceededResponse.body.error.code).toBe('SEAT_LIMIT_EXCEEDED');
      console.log('✅ Seat limit properly enforced');

      // Step 4: Increase seat limit
      console.log('📈 Increasing seat limit...');
      const increaseLimitResponse = await request(app)
        .put(`/api/tenants/${createdTenantId}/seat-limit`)
        .set('Authorization', JWTHelper.generateAuthHeader(masterAdminToken))
        .send({ seatLimit: 15 })
        .expect(200);

      expect(increaseLimitResponse.body.success).toBe(true);

      // Step 5: Now create the 11th user (should succeed)
      console.log('✅ Creating user after limit increase...');
      const newUserResponse = await request(app)
        .post(`/api/tenants/${createdTenantId}/users`)
        .set('Authorization', JWTHelper.generateAuthHeader(masterAdminToken))
        .send({
          email: 'user11@small-tenant.com',
          name: 'User 11',
          roles: ['user'],
        })
        .expect(201);

      expect(newUserResponse.body.success).toBe(true);
      console.log('🎉 Seat limit workflow completed successfully!');
    });

    test('should handle multi-tenant user management workflow', async () => {
      mockAuth0.mockBasicAuth0Operations();
      mockAuth0.mockCreateClient();
      mockAuth0.mockCreateUser();

      // Step 1: Create two tenants
      console.log('🏢 Creating multiple tenants...');
      const tenant1Response = await request(app)
        .post('/api/tenants')
        .set('Authorization', JWTHelper.generateAuthHeader(masterAdminToken))
        .send({
          name: 'Tenant One',
          domain: 'tenant-one',
          seatLimit: 20,
        })
        .expect(201);

      const tenant2Response = await request(app)
        .post('/api/tenants')
        .set('Authorization', JWTHelper.generateAuthHeader(masterAdminToken))
        .send({
          name: 'Tenant Two',
          domain: 'tenant-two',
          seatLimit: 15,
        })
        .expect(201);

      const tenant1Id = tenant1Response.body.data.tenant.id;
      const tenant2Id = tenant2Response.body.data.tenant.id;

      // Step 2: Create users in both tenants
      console.log('👥 Creating users in both tenants...');
      const user1Response = await request(app)
        .post(`/api/tenants/${tenant1Id}/users`)
        .set('Authorization', JWTHelper.generateAuthHeader(masterAdminToken))
        .send({
          email: 'user1@tenant-one.com',
          name: 'User One',
          roles: ['user'],
        })
        .expect(201);

      const user2Response = await request(app)
        .post(`/api/tenants/${tenant2Id}/users`)
        .set('Authorization', JWTHelper.generateAuthHeader(masterAdminToken))
        .send({
          email: 'user2@tenant-two.com',
          name: 'User Two',
          roles: ['user'],
        })
        .expect(201);

      // Step 3: Verify tenant isolation
      console.log('🔒 Verifying tenant isolation...');
      const tenant1Token = JWTHelper.generateTenantAdminToken(tenant1Id);
      const tenant2Token = JWTHelper.generateTenantAdminToken(tenant2Id);

      // Tenant 1 admin should not access Tenant 2 resources
      const isolationTestResponse = await request(app)
        .post(`/api/tenants/${tenant2Id}/validate-access`)
        .set('Authorization', JWTHelper.generateAuthHeader(tenant1Token))
        .expect(403);

      expect(isolationTestResponse.body.success).toBe(false);
      expect(isolationTestResponse.body.error.code).toBe('UNAUTHORIZED_TENANT_ACCESS');

      // Step 4: Verify seat usage for both tenants
      console.log('📊 Checking seat usage for both tenants...');
      const tenant1SeatResponse = await request(app)
        .get(`/api/tenants/${tenant1Id}/seat-usage`)
        .set('Authorization', JWTHelper.generateAuthHeader(masterAdminToken))
        .expect(200);

      const tenant2SeatResponse = await request(app)
        .get(`/api/tenants/${tenant2Id}/seat-usage`)
        .set('Authorization', JWTHelper.generateAuthHeader(masterAdminToken))
        .expect(200);

      expect(tenant1SeatResponse.body.data.seatUsage.seatUsed).toBe(1);
      expect(tenant2SeatResponse.body.data.seatUsage.seatUsed).toBe(1);

      // Step 5: List all tenants and verify both exist
      console.log('📋 Listing all tenants...');
      const listTenantsResponse = await request(app)
        .get('/api/tenants')
        .set('Authorization', JWTHelper.generateAuthHeader(masterAdminToken))
        .expect(200);

      expect(listTenantsResponse.body.success).toBe(true);
      expect(listTenantsResponse.body.data.tenants.length).toBeGreaterThanOrEqual(2);

      // Step 6: Clean up - delete users first
      console.log('🧹 Cleaning up users...');
      await request(app)
        .delete(`/api/users/${user1Response.body.data.user.id}`)
        .set('Authorization', JWTHelper.generateAuthHeader(masterAdminToken))
        .expect(200);

      await request(app)
        .delete(`/api/users/${user2Response.body.data.user.id}`)
        .set('Authorization', JWTHelper.generateAuthHeader(masterAdminToken))
        .expect(200);

      // Step 7: Clean up - delete tenants
      console.log('🧹 Cleaning up tenants...');
      await request(app)
        .delete(`/api/tenants/${tenant1Id}`)
        .set('Authorization', JWTHelper.generateAuthHeader(masterAdminToken))
        .expect(200);

      await request(app)
        .delete(`/api/tenants/${tenant2Id}`)
        .set('Authorization', JWTHelper.generateAuthHeader(masterAdminToken))
        .expect(200);

      console.log('🎉 Multi-tenant workflow completed successfully!');
    });

    test('should handle error scenarios in workflow', async () => {
      mockAuth0.mockBasicAuth0Operations();
      mockAuth0.mockCreateClient();

      // Step 1: Create tenant successfully
      const createTenantResponse = await request(app)
        .post('/api/tenants')
        .set('Authorization', JWTHelper.generateAuthHeader(masterAdminToken))
        .send({
          name: 'Error Test Tenant',
          domain: 'error-test-tenant',
          seatLimit: 5,
        })
        .expect(201);

      createdTenantId = createTenantResponse.body.data.tenant.id;

      // Step 2: Try to create duplicate tenant (should fail)
      console.log('🚫 Testing duplicate tenant creation...');
      const duplicateResponse = await request(app)
        .post('/api/tenants')
        .set('Authorization', JWTHelper.generateAuthHeader(masterAdminToken))
        .send({
          name: 'Another Tenant',
          domain: 'error-test-tenant', // Same domain
          seatLimit: 10,
        })
        .expect(409);

      expect(duplicateResponse.body.success).toBe(false);
      expect(duplicateResponse.body.error.code).toBe('TENANT_ALREADY_EXISTS');

      // Step 3: Try to delete tenant with users (should fail)
      console.log('🚫 Testing tenant deletion with users...');
      
      // First create a user
      mockAuth0.mockCreateUser();
      await request(app)
        .post(`/api/tenants/${createdTenantId}/users`)
        .set('Authorization', JWTHelper.generateAuthHeader(masterAdminToken))
        .send({
          email: 'user@error-test.com',
          name: 'Test User',
        })
        .expect(201);

      // Now try to delete tenant (should fail)
      const deleteWithUsersResponse = await request(app)
        .delete(`/api/tenants/${createdTenantId}`)
        .set('Authorization', JWTHelper.generateAuthHeader(masterAdminToken))
        .expect(400);

      expect(deleteWithUsersResponse.body.success).toBe(false);
      expect(deleteWithUsersResponse.body.error.code).toBe('BUSINESS_LOGIC_ERROR');
      expect(deleteWithUsersResponse.body.error.message).toContain('active users');

      console.log('✅ Error scenarios handled correctly');
    });

    test('should handle role-based access workflow', async () => {
      mockAuth0.mockBasicAuth0Operations();
      mockAuth0.mockCreateClient();
      mockAuth0.mockCreateUser();
      mockAuth0.mockGetUser('auth0|tenant_admin_123');
      mockAuth0.mockGetUser('auth0|regular_user_123');

      // Step 1: Create tenant as master admin
      const createTenantResponse = await request(app)
        .post('/api/tenants')
        .set('Authorization', JWTHelper.generateAuthHeader(masterAdminToken))
        .send({
          name: 'Role Test Tenant',
          domain: 'role-test-tenant',
          seatLimit: 20,
        })
        .expect(201);

      createdTenantId = createTenantResponse.body.data.tenant.id;

      // Step 2: Create tenant admin user
      const createAdminResponse = await request(app)
        .post(`/api/tenants/${createdTenantId}/users`)
        .set('Authorization', JWTHelper.generateAuthHeader(masterAdminToken))
        .send({
          email: 'admin@role-test.com',
          name: 'Tenant Admin',
          roles: ['tenant_admin'],
        })
        .expect(201);

      // Step 3: Create regular user
      const createUserResponse = await request(app)
        .post(`/api/tenants/${createdTenantId}/users`)
        .set('Authorization', JWTHelper.generateAuthHeader(masterAdminToken))
        .send({
          email: 'user@role-test.com',
          name: 'Regular User',
          roles: ['user'],
        })
        .expect(201);

      // Step 4: Test tenant admin access
      console.log('🔑 Testing tenant admin access...');
      const tenantAdminToken = JWTHelper.generateTenantAdminToken(createdTenantId, {
        sub: createAdminResponse.body.data.user.id,
      });

      // Tenant admin should be able to list users in their tenant
      const adminListUsersResponse = await request(app)
        .get('/api/users')
        .set('Authorization', JWTHelper.generateAuthHeader(tenantAdminToken))
        .expect(200);

      expect(adminListUsersResponse.body.success).toBe(true);

      // But should not be able to access master tenant functions
      const adminAccessTenantsResponse = await request(app)
        .get('/api/tenants')
        .set('Authorization', JWTHelper.generateAuthHeader(tenantAdminToken))
        .expect(403);

      expect(adminAccessTenantsResponse.body.success).toBe(false);

      // Step 5: Test regular user access
      console.log('👤 Testing regular user access...');
      const regularUserToken = JWTHelper.generateUserToken(createdTenantId, {
        sub: createUserResponse.body.data.user.id,
      });

      // Regular user should be able to access their own profile
      const userProfileResponse = await request(app)
        .get('/api/users/me')
        .set('Authorization', JWTHelper.generateAuthHeader(regularUserToken))
        .expect(200);

      expect(userProfileResponse.body.success).toBe(true);

      // But should not be able to create other users
      const userCreateResponse = await request(app)
        .post('/api/users')
        .set('Authorization', JWTHelper.generateAuthHeader(regularUserToken))
        .send({
          email: 'another@role-test.com',
          name: 'Another User',
        })
        .expect(403);

      expect(userCreateResponse.body.success).toBe(false);

      console.log('✅ Role-based access workflow completed successfully!');
    });
  });

  describe('Performance and Stress Testing', () => {
    test('should handle rapid tenant operations', async () => {
      mockAuth0.mockBasicAuth0Operations();
      
      // Mock multiple client creations
      for (let i = 1; i <= 5; i++) {
        mockAuth0.mockCreateClient({
          client_id: `client_${i}`,
          client_secret: `secret_${i}`,
        });
      }

      console.log('⚡ Testing rapid tenant creation...');
      const tenantCreationPromises = [];
      
      for (let i = 1; i <= 5; i++) {
        tenantCreationPromises.push(
          request(app)
            .post('/api/tenants')
            .set('Authorization', JWTHelper.generateAuthHeader(masterAdminToken))
            .send({
              name: `Rapid Tenant ${i}`,
              domain: `rapid-tenant-${i}`,
              seatLimit: 10,
            })
        );
      }

      const responses = await Promise.all(tenantCreationPromises);
      
      // All should succeed
      responses.forEach((response, index) => {
        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data.tenant.name).toBe(`Rapid Tenant ${index + 1}`);
      });

      console.log('✅ Rapid operations handled successfully');
    });

    test('should maintain data consistency under concurrent operations', async () => {
      mockAuth0.mockBasicAuth0Operations();
      mockAuth0.mockCreateClient();
      mockAuth0.mockCreateUser();

      // Create a tenant
      const createTenantResponse = await request(app)
        .post('/api/tenants')
        .set('Authorization', JWTHelper.generateAuthHeader(masterAdminToken))
        .send({
          name: 'Concurrency Test Tenant',
          domain: 'concurrency-test',
          seatLimit: 10,
        })
        .expect(201);

      const tenantId = createTenantResponse.body.data.tenant.id;

      // Perform concurrent operations
      console.log('🔄 Testing concurrent operations...');
      const concurrentPromises = [
        // Get tenant details
        request(app)
          .get(`/api/tenants/${tenantId}`)
          .set('Authorization', JWTHelper.generateAuthHeader(masterAdminToken)),
        
        // Update tenant
        request(app)
          .put(`/api/tenants/${tenantId}`)
          .set('Authorization', JWTHelper.generateAuthHeader(masterAdminToken))
          .send({ name: 'Updated Concurrency Test' }),
        
        // Get seat usage
        request(app)
          .get(`/api/tenants/${tenantId}/seat-usage`)
          .set('Authorization', JWTHelper.generateAuthHeader(masterAdminToken)),
        
        // Create user
        request(app)
          .post(`/api/tenants/${tenantId}/users`)
          .set('Authorization', JWTHelper.generateAuthHeader(masterAdminToken))
          .send({
            email: 'concurrent@test.com',
            name: 'Concurrent User',
          }),
      ];

      const concurrentResponses = await Promise.all(concurrentPromises);
      
      // All operations should complete successfully
      concurrentResponses.forEach(response => {
        expect([200, 201]).toContain(response.status);
        expect(response.body.success).toBe(true);
      });

      console.log('✅ Concurrent operations maintained consistency');
    });
  });

  describe('Data Integrity Validation', () => {
    test('should maintain referential integrity throughout workflow', async () => {
      mockAuth0.mockBasicAuth0Operations();
      mockAuth0.mockCreateClient();
      mockAuth0.mockCreateUser();
      mockAuth0.mockGetUser('auth0|integrity_user_123');

      // Create tenant and user
      const tenantResponse = await request(app)
        .post('/api/tenants')
        .set('Authorization', JWTHelper.generateAuthHeader(masterAdminToken))
        .send({
          name: 'Integrity Test Tenant',
          domain: 'integrity-test',
          seatLimit: 10,
        })
        .expect(201);

      const tenantId = tenantResponse.body.data.tenant.id;

      const userResponse = await request(app)
        .post(`/api/tenants/${tenantId}/users`)
        .set('Authorization', JWTHelper.generateAuthHeader(masterAdminToken))
        .send({
          email: 'integrity@test.com',
          name: 'Integrity User',
        })
        .expect(201);

      const userId = userResponse.body.data.user.id;

      // Verify user belongs to correct tenant
      const userDetailsResponse = await request(app)
        .get(`/api/users/${userId}`)
        .set('Authorization', JWTHelper.generateAuthHeader(masterAdminToken))
        .expect(200);

      expect(userDetailsResponse.body.data.user.tenantId).toBe(tenantId);

      // Verify seat count is accurate
      const seatUsageResponse = await request(app)
        .get(`/api/tenants/${tenantId}/seat-usage`)
        .set('Authorization', JWTHelper.generateAuthHeader(masterAdminToken))
        .expect(200);

      expect(seatUsageResponse.body.data.seatUsage.seatUsed).toBe(1);

      console.log('✅ Data integrity maintained throughout workflow');
    });
  });
});