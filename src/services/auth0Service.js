const { ManagementClient, AuthenticationClient } = require('auth0');
const config = require('../config');
const logger = require('../utils/logger');
const axios = require('axios');

class Auth0Service {
  constructor() {
    this.managementClient = null;
    this.authenticationClient = null;
    this.managementToken = null;
    this.tokenExpiresAt = null;

    // In-memory stores for mock mode
    this._mock = {
      enabled: config.development.mockAuth0Api === true,
      users: new Map(), // key: user_id, value: user object
      clients: new Map(), // key: client_id, value: client object
      roles: new Map(), // key: user_id, value: Set(roleIds)
    };

    logger.info('Auth0Service constructor called', {
      mockEnabled: this._mock.enabled,
      mockConfigValue: config.development.mockAuth0Api,
      envMockValue: process.env.MOCK_AUTH0_API
    });

    this.initializeClients();
  }

  /**
   * Initialize Auth0 clients
   */
  initializeClients() {
    try {
      if (this._mock.enabled) {
        // Create mock/stub clients that do not perform network calls
        this.managementClient = this.createMockManagementClient();
        this.authenticationClient = this.createMockAuthenticationClient();
        logger.info('Auth0 mock clients initialized');
        return;
      }

      // Initialize real Management Client
      logger.info('Initializing real Auth0 Management Client', {
        domain: config.auth0.master.domain,
        clientId: config.auth0.master.clientId ? '***' : 'MISSING',
        audience: config.auth0.master.managementApiAudience,
      });

      this.managementClient = new ManagementClient({
        domain: config.auth0.master.domain,
        clientId: config.auth0.master.clientId,
        clientSecret: config.auth0.master.clientSecret,
        audience: config.auth0.master.managementApiAudience,
        scope: config.auth0.master.managementApiScope,
      });

      // Initialize real Authentication Client
      this.authenticationClient = new AuthenticationClient({
        domain: config.auth0.master.domain,
        clientId: config.auth0.master.clientId,
        clientSecret: config.auth0.master.clientSecret,
      });

      logger.info('Auth0 clients initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Auth0 clients:', error);
      throw error;
    }
  }

  /**
   * Create a mock Authentication Client
   */
  createMockAuthenticationClient() {
    return {
      clientCredentialsGrant: async () => {
        // Return a deterministic mock token
        return {
          access_token: 'mock_management_token',
          token_type: 'Bearer',
          expires_in: 3600,
          scope: config.auth0.master.managementApiScope,
        };
      },
    };
  }

  /**
   * Create a mock Management Client with in-memory behavior
   */
  createMockManagementClient() {
    const self = this;

    return {
      // Clients namespace for new Auth0 SDK
      clients: {
        create: async (payload) => {
          const client_id = `mock_client_${Math.random().toString(36).slice(2, 10)}`;
          const client_secret = `mock_secret_${Math.random().toString(36).slice(2, 18)}`;
          const client = {
            client_id,
            client_secret,
            name: payload.name,
            description: payload.description,
            app_type: payload.app_type || 'regular_web',
            callbacks: payload.callbacks || [],
            allowed_origins: payload.allowed_origins || [],
            web_origins: payload.web_origins || [],
            grant_types: payload.grant_types || ['authorization_code', 'refresh_token', 'client_credentials'],
            token_endpoint_auth_method: payload.token_endpoint_auth_method || 'client_secret_post',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          self._mock.clients.set(client_id, client);
          return { data: client };
        },
        delete: async ({ client_id }) => {
          self._mock.clients.delete(client_id);
          return { data: {} };
        },
      },

      // Users namespace for new Auth0 SDK
      users: {
        getAll: async (params = {}) => {
          const allUsers = Array.from(self._mock.users.values());
          let filtered = allUsers;

          if (params.q) {
            const q = params.q.toLowerCase();
            filtered = filtered.filter(
              (u) =>
                (u.email && u.email.toLowerCase().includes(q)) ||
                (u.name && u.name.toLowerCase().includes(q))
            );
          }

          const page = params.page || 0;
          const per_page = params.per_page || 10;
          const start = page * per_page;
          const slice = filtered.slice(start, start + per_page);

          return {
            data: slice,
            start: page,
            limit: per_page,
            total: filtered.length,
          };
        },
        create: async (payload) => {
          const user_id = `auth0|mock_${Math.random().toString(36).slice(2, 12)}`;
          const nowIso = new Date().toISOString();
          const user = {
            user_id,
            email: payload.email,
            name: payload.name,
            created_at: nowIso,
            updated_at: nowIso,
            email_verified: !!payload.email_verified,
            user_metadata: payload.user_metadata || {},
            app_metadata: payload.app_metadata || {},
          };
          self._mock.users.set(user_id, user);
          return { data: user };
        },
        get: async ({ id }) => {
          if (!self._mock.users.has(id)) {
            const err = new Error('The user does not exist.');
            err.statusCode = 404;
            err.error = 'Not Found';
            err.error_description = 'User not found';
            throw err;
          }
          return { data: self._mock.users.get(id) };
        },
        update: async ({ id }, updates) => {
          const existing = self._mock.users.get(id);
          if (!existing) {
            const err = new Error('The user does not exist.');
            err.statusCode = 404;
            err.error = 'Not Found';
            err.error_description = 'User not found';
            throw err;
          }
          const updated = {
            ...existing,
            ...updates,
            updated_at: new Date().toISOString(),
          };
          self._mock.users.set(id, updated);
          return { data: updated };
        },
        delete: async ({ id }) => {
          if (!self._mock.users.has(id)) {
            const err = new Error('The user does not exist.');
            err.statusCode = 404;
            err.error = 'Not Found';
            err.error_description = 'User not found';
            throw err;
          }
          self._mock.users.delete(id);
          return { data: {} };
        },
        getRoles: async ({ id }) => {
          const rolesSet = self._mock.roles.get(id) || new Set(['user']);
          return { data: Array.from(rolesSet).map((name, idx) => ({ id: `rol_mock_${idx}`, name })) };
        },
        assignRoles: async ({ id }, { roles }) => {
          const rolesSet = self._mock.roles.get(id) || new Set(['user']);
          roles.forEach((r) => rolesSet.add(r));
          self._mock.roles.set(id, rolesSet);
          return { data: {} };
        },
        removeRoles: async ({ id }, { roles }) => {
          const rolesSet = self._mock.roles.get(id) || new Set(['user']);
          roles.forEach((r) => rolesSet.delete(r));
          self._mock.roles.set(id, rolesSet);
          return { data: {} };
        },
      },

      // Legacy methods for backward compatibility
      createClient: async (payload) => {
        const result = await this.clients.create(payload);
        return result.data;
      },
      getUsers: async (params = {}) => {
        const result = await this.users.getAll(params);
        return {
          users: result.data,
          start: result.start,
          limit: result.limit,
          total: result.total,
        };
      },
      createUser: async (payload) => {
        const result = await this.users.create(payload);
        return result.data;
      },
      getUser: async ({ id }) => {
        const result = await this.users.get({ id });
        return result.data;
      },
      updateUser: async ({ id }, updates) => {
        const result = await this.users.update({ id }, updates);
        return result.data;
      },
      deleteUser: async ({ id }) => {
        const result = await this.users.delete({ id });
        return result.data;
      },
      getUserRoles: async ({ id }) => {
        const result = await this.users.getRoles({ id });
        return result.data;
      },
      assignRolestoUser: async ({ id }, { roles }) => {
        const result = await this.users.assignRoles({ id }, { roles });
        return result.data;
      },
      removeRolesFromUser: async ({ id }, { roles }) => {
        const result = await this.users.removeRoles({ id }, { roles });
        return result.data;
      },
    };
  }

  /**
   * Get a valid Management API token
   */
  async getManagementToken() {
    try {
      // Mock mode shortcut
      if (this._mock.enabled) {
        if (!this.managementToken || !this.tokenExpiresAt || Date.now() >= this.tokenExpiresAt) {
          this.managementToken = 'mock_management_token';
          this.tokenExpiresAt = Date.now() + (3600 * 1000) - (5 * 60 * 1000);
        }
        return this.managementToken;
      }

      // Check if current token is still valid
      if (this.managementToken && this.tokenExpiresAt && Date.now() < this.tokenExpiresAt) {
        return this.managementToken;
      }

      // Get new token from real Auth0
      let tokenResponse;
      try {
        if (
          this.authenticationClient &&
          this.authenticationClient.oauth &&
          typeof this.authenticationClient.oauth.clientCredentialsGrant === 'function'
        ) {
          const resp = await this.authenticationClient.oauth.clientCredentialsGrant({
            audience: config.auth0.master.managementApiAudience,
            scope: config.auth0.master.managementApiScope,
          });
          tokenResponse = resp?.data || resp;
        } else {
          throw new Error('oauth.clientCredentialsGrant not available on AuthenticationClient');
        }
      } catch (e) {
        // Fallback to direct token endpoint
        logger.warn('Falling back to direct token request for Management API token:', e.message || e);
        const url = `https://${config.auth0.master.domain}/oauth/token`;
        const payload = {
          client_id: config.auth0.master.clientId,
          client_secret: config.auth0.master.clientSecret,
          audience: config.auth0.master.managementApiAudience,
          grant_type: 'client_credentials',
        };
        if (config.auth0.master.managementApiScope) {
          payload.scope = config.auth0.master.managementApiScope;
        }
        const { data } = await axios.post(url, payload, {
          headers: { 'content-type': 'application/json' },
          timeout: 15000,
        });
        tokenResponse = data;
      }

      this.managementToken = tokenResponse.access_token;
      // Set expiration time (subtract 5 minutes for safety)
      this.tokenExpiresAt = Date.now() + (tokenResponse.expires_in * 1000) - (5 * 60 * 1000);

      logger.info('Management API token refreshed');
      return this.managementToken;
    } catch (error) {
      logger.error('Failed to get Management API token:', error);
      throw error;
    }
  }

  /**
   * Create a new Auth0 tenant (Note: Conceptual)
   */
  async createTenant(tenantData) {
    try {
      logger.info('Creating tenant:', tenantData.name);

      // Simulate tenant creation by creating a client
      const clientResult = await this.managementClient.clients.create({
        name: `${tenantData.name} - Client`,
        description: `Client application for tenant: ${tenantData.name}`,
        app_type: 'regular_web',
        callbacks: tenantData.callbacks || [],
        allowed_origins: tenantData.allowedOrigins || [],
        web_origins: tenantData.webOrigins || [],
        grant_types: ['authorization_code', 'refresh_token', 'client_credentials'],
        token_endpoint_auth_method: 'client_secret_post',
      });

      const client = clientResult.data || clientResult;
      const tenantInfo = {
        id: `tenant_${Date.now()}`,
        name: tenantData.name,
        domain: tenantData.domain,
        auth0ClientId: client.client_id,
        auth0ClientSecret: client.client_secret,
        seatLimit: tenantData.seatLimit || config.seats.defaultLimit,
        seatUsed: 0,
        status: 'active',
        metadata: tenantData.metadata || {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      logger.info('Tenant created successfully:', tenantInfo.id);
      return tenantInfo;
    } catch (error) {
      logger.error('Failed to create tenant:', error);
      throw error;
    }
  }

  /**
   * Get users from a specific tenant domain
   */
  async getUsers(tenantDomain, options = {}) {
    try {
      const { page = 0, per_page = 10, search, connection } = options;

      const params = {
        page,
        per_page,
        include_totals: true,
      };

      if (search) {
        params.search_engine = 'v3';
        params.q = search;
      }

      if (connection) {
        params.connection = connection;
      }

      const usersResult = await this.managementClient.users.getAll(params);
      const users = usersResult.data || usersResult;

      logger.info(`Retrieved ${users.length} users for tenant: ${tenantDomain}`);
      return {
        users: users,
        start: usersResult.start || 0,
        limit: usersResult.limit || per_page,
        total: usersResult.total || users.length,
      };
    } catch (error) {
      logger.error('Failed to get users:', error);
      throw error;
    }
  }

  /**
   * Create a new user in a specific tenant
   */
  async createUser(tenantDomain, userData) {
    try {
      const userPayload = {
        email: userData.email,
        password: userData.password,
        name: userData.name,
        connection: userData.connection || 'Username-Password-Authentication',
        email_verified: userData.emailVerified || false,
        user_metadata: userData.metadata || {},
        app_metadata: {
          tenant_id: userData.tenantId,
          roles: userData.roles || ['user'],
          ...userData.appMetadata,
        },
      };

      const userResult = await this.managementClient.users.create(userPayload);
      const user = userResult.data || userResult;

      logger.info('User created successfully:', user.user_id);
      return user;
    } catch (error) {
      logger.error('Failed to create user:', error);
      throw error;
    }
  }

  /**
   * Get a specific user
   */
  async getUser(userId) {
    try {
      logger.info('getUser called', {
        userId,
        mockEnabled: this._mock.enabled,
        managementClientType: typeof this.managementClient,
        managementClientKeys: this.managementClient ? Object.keys(this.managementClient) : null,
        hasUsersNamespace: this.managementClient && this.managementClient.users,
        usersNamespaceType: this.managementClient && this.managementClient.users ? typeof this.managementClient.users : null,
        usersNamespaceKeys: this.managementClient && this.managementClient.users ? Object.keys(this.managementClient.users) : null,
      });

      // Add debugging to check if users namespace exists
      if (!this.managementClient) {
        throw new Error('Management client is not initialized');
      }
      
      if (!this.managementClient.users) {
        throw new Error('Management client users namespace is not available');
      }
      
      if (typeof this.managementClient.users.get !== 'function') {
        throw new Error('Management client users.get is not a function. Available methods: ' + 
          Object.keys(this.managementClient.users || {}).join(', '));
      }

      const userResult = await this.managementClient.users.get({ id: userId });
      const user = userResult.data || userResult;
      logger.info('User retrieved:', userId);
      return user;
    } catch (error) {
      logger.error('Failed to get user:', error);
      throw error;
    }
  }

  /**
   * Update user information
   */
  async updateUser(userId, updates) {
    try {
      const userResult = await this.managementClient.users.update({ id: userId }, updates);
      const user = userResult.data || userResult;
      logger.info('User updated successfully:', userId);
      return user;
    } catch (error) {
      logger.error('Failed to update user:', error);
      throw error;
    }
  }

  /**
   * Delete a user
   */
  async deleteUser(userId) {
    try {
      logger.info('deleteUser called', {
        userId,
        mockEnabled: this._mock.enabled,
        managementClientType: typeof this.managementClient,
        managementClientKeys: this.managementClient ? Object.keys(this.managementClient) : null,
        hasUsersNamespace: this.managementClient && this.managementClient.users,
        usersNamespaceType: this.managementClient && this.managementClient.users ? typeof this.managementClient.users : null,
        usersNamespaceKeys: this.managementClient && this.managementClient.users ? Object.keys(this.managementClient.users) : null,
      });

      // Add debugging to check if users namespace exists
      if (!this.managementClient) {
        throw new Error('Management client is not initialized');
      }
      
      if (!this.managementClient.users) {
        throw new Error('Management client users namespace is not available');
      }
      
      if (typeof this.managementClient.users.delete !== 'function') {
        throw new Error('Management client users.delete is not a function. Available methods: ' + 
          Object.keys(this.managementClient.users || {}).join(', '));
      }

      await this.managementClient.users.delete({ id: userId });
      logger.info('User deleted successfully:', userId);
      return { id: userId, deleted: true };
    } catch (error) {
      logger.error('Failed to delete user:', error);
      throw error;
    }
  }

  /**
   * Get user roles
   */
  async getUserRoles(userId) {
    try {
      logger.info('getUserRoles called', {
        userId,
        mockEnabled: this._mock.enabled,
        managementClientType: typeof this.managementClient,
        managementClientKeys: this.managementClient ? Object.keys(this.managementClient) : null,
        hasUsersNamespace: this.managementClient && this.managementClient.users,
        usersNamespaceType: this.managementClient && this.managementClient.users ? typeof this.managementClient.users : null,
        usersNamespaceKeys: this.managementClient && this.managementClient.users ? Object.keys(this.managementClient.users) : null,
      });

      // Add debugging to check if users namespace exists
      if (!this.managementClient) {
        throw new Error('Management client is not initialized');
      }
      
      if (!this.managementClient.users) {
        throw new Error('Management client users namespace is not available');
      }
      
      if (typeof this.managementClient.users.getRoles !== 'function') {
        throw new Error('Management client users.getRoles is not a function. Available methods: ' + 
          Object.keys(this.managementClient.users || {}).join(', '));
      }

      const rolesResult = await this.managementClient.users.getRoles({ id: userId });
      const roles = rolesResult.data || rolesResult;
      logger.info(`Retrieved ${roles.length} roles for user: ${userId}`);
      return roles;
    } catch (error) {
      logger.error('Failed to get user roles:', error);
      throw error;
    }
  }

  /**
   * Assign roles to user
   */
  async assignRoles(userId, roleIds) {
    try {
      await this.managementClient.users.assignRoles(
        { id: userId },
        { roles: roleIds }
      );
      logger.info(`Assigned ${roleIds.length} roles to user: ${userId}`);
      return { userId, roleIds, assigned: true };
    } catch (error) {
      logger.error('Failed to assign roles:', error);
      throw error;
    }
  }

  /**
   * Remove roles from user
   */
  async removeRoles(userId, roleIds) {
    try {
      await this.managementClient.users.removeRoles(
        { id: userId },
        { roles: roleIds }
      );
      logger.info(`Removed ${roleIds.length} roles from user: ${userId}`);
      return { userId, roleIds, removed: true };
    } catch (error) {
      logger.error('Failed to remove roles:', error);
      throw error;
    }
  }

  /**
   * Validate JWT token from a specific tenant
   */
  async validateToken(token, tenantDomain) {
    try {
      logger.info('Validating token for tenant:', tenantDomain);
      // Implementation would depend on your JWT validation strategy
      // For now, return a mock validation
      return {
        valid: true,
        decoded: {
          sub: 'user_123',
          email: 'user@example.com',
          tenant_id: 'tenant_123',
          roles: ['user'],
        },
      };
    } catch (error) {
      logger.error('Failed to validate token:', error);
      throw error;
    }
  }
}

module.exports = Auth0Service;