const nock = require('nock');
const config = require('../../src/config');

class MockAuth0 {
  constructor() {
    this.baseUrl = `https://${config.auth0.master.domain}`;
    this.managementApiUrl = `https://${config.auth0.master.domain}/api/v2`;
  }

  /**
   * Mock Auth0 Management API token endpoint
   */
  mockManagementToken(token = 'mock_management_token', expiresIn = 3600) {
    return nock(this.baseUrl)
      .post('/oauth/token')
      .reply(200, {
        access_token: token,
        token_type: 'Bearer',
        expires_in: expiresIn,
        scope: config.auth0.master.managementApiScope,
      });
  }

  /**
   * Mock Auth0 Management API token endpoint with error
   */
  mockManagementTokenError(statusCode = 401, error = 'unauthorized') {
    return nock(this.baseUrl)
      .post('/oauth/token')
      .reply(statusCode, {
        error,
        error_description: 'Invalid client credentials',
      });
  }

  /**
   * Mock get users endpoint
   */
  mockGetUsers(users = [], total = null) {
    const response = {
      users,
      start: 0,
      limit: 50,
      total: total || users.length,
    };

    return nock(this.managementApiUrl)
      .get('/users')
      .query(true)
      .reply(200, response);
  }

  /**
   * Mock create user endpoint
   */
  mockCreateUser(userData = {}) {
    const defaultUser = {
      user_id: 'auth0|mock_user_123',
      email: 'test@example.com',
      name: 'Test User',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      email_verified: false,
      user_metadata: {},
      app_metadata: {
        tenant_id: 'test_tenant_123',
        roles: ['user'],
      },
      ...userData,
    };

    return nock(this.managementApiUrl)
      .post('/users')
      .reply(201, defaultUser);
  }

  /**
   * Mock create user endpoint with error
   */
  mockCreateUserError(statusCode = 400, error = 'Bad Request') {
    return nock(this.managementApiUrl)
      .post('/users')
      .reply(statusCode, {
        statusCode,
        error,
        message: 'The user already exists.',
        errorCode: 'auth0_idp_error',
      });
  }

  /**
   * Mock get user endpoint
   */
  mockGetUser(userId, userData = {}) {
    const defaultUser = {
      user_id: userId,
      email: 'test@example.com',
      name: 'Test User',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      email_verified: false,
      user_metadata: {},
      app_metadata: {
        tenant_id: 'test_tenant_123',
        roles: ['user'],
      },
      ...userData,
    };

    return nock(this.managementApiUrl)
      .get(`/users/${encodeURIComponent(userId)}`)
      .reply(200, defaultUser);
  }

  /**
   * Mock get user endpoint with error
   */
  mockGetUserError(userId, statusCode = 404) {
    return nock(this.managementApiUrl)
      .get(`/users/${encodeURIComponent(userId)}`)
      .reply(statusCode, {
        statusCode,
        error: 'Not Found',
        message: 'The user does not exist.',
      });
  }

  /**
   * Mock update user endpoint
   */
  mockUpdateUser(userId, updatedData = {}) {
    const defaultUser = {
      user_id: userId,
      email: 'test@example.com',
      name: 'Test User Updated',
      updated_at: new Date().toISOString(),
      ...updatedData,
    };

    return nock(this.managementApiUrl)
      .patch(`/users/${encodeURIComponent(userId)}`)
      .reply(200, defaultUser);
  }

  /**
   * Mock delete user endpoint
   */
  mockDeleteUser(userId) {
    return nock(this.managementApiUrl)
      .delete(`/users/${encodeURIComponent(userId)}`)
      .reply(204);
  }

  /**
   * Mock get user roles endpoint
   */
  mockGetUserRoles(userId, roles = []) {
    const defaultRoles = roles.length > 0 ? roles : [
      {
        id: 'rol_mock123',
        name: 'user',
        description: 'Regular user role',
      },
    ];

    return nock(this.managementApiUrl)
      .get(`/users/${encodeURIComponent(userId)}/roles`)
      .reply(200, defaultRoles);
  }

  /**
   * Mock assign roles to user endpoint
   */
  mockAssignRoles(userId) {
    return nock(this.managementApiUrl)
      .post(`/users/${encodeURIComponent(userId)}/roles`)
      .reply(204);
  }

  /**
   * Mock remove roles from user endpoint
   */
  mockRemoveRoles(userId) {
    return nock(this.managementApiUrl)
      .delete(`/users/${encodeURIComponent(userId)}/roles`)
      .reply(204);
  }

  /**
   * Mock create client endpoint (for tenant creation)
   */
  mockCreateClient(clientData = {}) {
    const defaultClient = {
      client_id: 'mock_client_123',
      client_secret: 'mock_client_secret_123',
      name: 'Test Client',
      description: 'Test client for tenant',
      app_type: 'regular_web',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...clientData,
    };

    return nock(this.managementApiUrl)
      .post('/clients')
      .reply(201, defaultClient);
  }

  /**
   * Mock get clients endpoint
   */
  mockGetClients(clients = []) {
    return nock(this.managementApiUrl)
      .get('/clients')
      .query(true)
      .reply(200, clients);
  }

  /**
   * Mock delete client endpoint
   */
  mockDeleteClient(clientId) {
    return nock(this.managementApiUrl)
      .delete(`/clients/${clientId}`)
      .reply(204);
  }

  /**
   * Mock JWKS endpoint
   */
  mockJWKS(keys = []) {
    const defaultKeys = keys.length > 0 ? keys : [
      {
        kty: 'RSA',
        use: 'sig',
        kid: 'mock_key_123',
        n: 'mock_n_value',
        e: 'AQAB',
      },
    ];

    return nock(this.baseUrl)
      .get('/.well-known/jwks.json')
      .reply(200, { keys: defaultKeys });
  }

  /**
   * Mock all Auth0 endpoints for basic operations
   */
  mockBasicAuth0Operations() {
    this.mockManagementToken();
    this.mockGetUsers();
    this.mockCreateUser();
    this.mockJWKS();
    return this;
  }

  /**
   * Mock Auth0 operations with errors
   */
  mockAuth0WithErrors() {
    this.mockManagementTokenError();
    this.mockCreateUserError();
    this.mockGetUserError('auth0|nonexistent');
    return this;
  }

  /**
   * Clear all nock mocks
   */
  static clearMocks() {
    nock.cleanAll();
  }

  /**
   * Enable nock recording (for debugging)
   */
  static enableRecording() {
    nock.recorder.rec({
      dont_print: true,
      output_objects: true,
    });
  }

  /**
   * Get recorded nock calls
   */
  static getRecordedCalls() {
    return nock.recorder.play();
  }

  /**
   * Check if all mocks have been used
   */
  static checkMocks() {
    if (!nock.isDone()) {
      console.warn('Unused nock mocks:', nock.pendingMocks());
    }
  }

  /**
   * Create a complete mock setup for testing
   */
  static setupCompleteMocks() {
    const mockAuth0 = new MockAuth0();
    return mockAuth0.mockBasicAuth0Operations();
  }

  /**
   * Create mock setup with errors for error testing
   */
  static setupErrorMocks() {
    const mockAuth0 = new MockAuth0();
    return mockAuth0.mockAuth0WithErrors();
  }
}

module.exports = MockAuth0;