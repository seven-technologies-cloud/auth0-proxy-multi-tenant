import axios from 'axios';
import config from '../config/env.js';
import tokenCache from '../utils/tokenCache.js';
import { retryWithBackoff } from '../utils/retry.js';

/**
 * Auth0 Management API Service
 * Handles token management, caching, and API calls with retry logic
 */
class Auth0Service {
  constructor() {
    this.baseURL = `https://${config.auth0.domain}/api/v2`;
    this.tokenURL = `https://${config.auth0.domain}/oauth/token`;
    this.cacheKey = 'auth0_mgmt_token';
    
    // Create axios instance for Management API calls
    this.api = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor to ensure valid token
    this.api.interceptors.request.use(async (config) => {
      const token = await this.getValidToken();
      config.headers.Authorization = `Bearer ${token}`;
      return config;
    });
  }

  /**
   * Get a valid Management API token (from cache or refresh)
   * @returns {Promise<string>} - Valid JWT token
   */
  async getValidToken() {
    // Check if we have a valid cached token
    const cachedToken = tokenCache.get(this.cacheKey);
    
    if (cachedToken && !tokenCache.needsRefresh(this.cacheKey)) {
      return cachedToken;
    }

    // Token needs refresh or doesn't exist
    return await this.refreshToken();
  }

  /**
   * Refresh the Management API token using client credentials
   * @returns {Promise<string>} - New JWT token
   */
  async refreshToken() {
    try {
      const response = await retryWithBackoff(async () => {
        return await axios.post(this.tokenURL, {
          client_id: config.auth0.mgmtClientId,
          client_secret: config.auth0.mgmtClientSecret,
          audience: `https://${config.auth0.domain}/api/v2/`,
          grant_type: 'client_credentials',
        }, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000,
        });
      });

      const { access_token, expires_in } = response.data;
      
      // Cache the token with TTL
      tokenCache.set(this.cacheKey, access_token, expires_in);
      
      return access_token;
    } catch (error) {
      console.error('Failed to refresh Auth0 Management API token:', error.response?.data || error.message);
      throw new Error('Failed to obtain Management API token');
    }
  }

  /**
   * Search users with Auth0 Management API
   * @param {object} params - Search parameters
   * @returns {Promise<object>} - Users search results
   */
  async searchUsers(params = {}) {
    try {
      const response = await retryWithBackoff(async () => {
        return await this.api.get('/users', { params });
      });

      return response.data;
    } catch (error) {
      throw this.normalizeAuth0Error(error);
    }
  }

  /**
   * Get a user by ID
   * @param {string} userId - User ID
   * @returns {Promise<object>} - User object
   */
  async getUser(userId) {
    try {
      const response = await retryWithBackoff(async () => {
        return await this.api.get(`/users/${encodeURIComponent(userId)}`);
      });

      return response.data;
    } catch (error) {
      throw this.normalizeAuth0Error(error);
    }
  }

  /**
   * Create a new user
   * @param {object} userData - User data
   * @returns {Promise<object>} - Created user object
   */
  async createUser(userData) {
    try {
      const response = await retryWithBackoff(async () => {
        return await this.api.post('/users', userData);
      });

      return response.data;
    } catch (error) {
      throw this.normalizeAuth0Error(error);
    }
  }

  /**
   * Update a user
   * @param {string} userId - User ID
   * @param {object} userData - User data to update
   * @returns {Promise<object>} - Updated user object
   */
  async updateUser(userId, userData) {
    try {
      const response = await retryWithBackoff(async () => {
        return await this.api.patch(`/users/${encodeURIComponent(userId)}`, userData);
      });

      return response.data;
    } catch (error) {
      throw this.normalizeAuth0Error(error);
    }
  }

  /**
   * Delete a user
   * @param {string} userId - User ID
   * @returns {Promise<void>}
   */
  async deleteUser(userId) {
    try {
      await retryWithBackoff(async () => {
        return await this.api.delete(`/users/${encodeURIComponent(userId)}`);
      });
    } catch (error) {
      throw this.normalizeAuth0Error(error);
    }
  }

  /**
   * Search for a user by email (for idempotent create)
   * @param {string} email - User email
   * @returns {Promise<object|null>} - User object if found, null otherwise
   */
  async findUserByEmail(email) {
    try {
      const results = await this.searchUsers({
        q: `email:"${email}"`,
        search_engine: 'v3',
      });

      return results.users && results.users.length > 0 ? results.users[0] : null;
    } catch (error) {
      // If search fails, return null to allow create to proceed
      console.warn('Failed to search for existing user by email:', error.message);
      return null;
    }
  }

  /**
   * Normalize Auth0 API errors into consistent format
   * @param {Error} error - Original error
   * @returns {Error} - Normalized error
   */
  normalizeAuth0Error(error) {
    if (!error.response) {
      // Network or other non-HTTP error
      const normalizedError = new Error('Auth0 API request failed');
      normalizedError.statusCode = 503;
      normalizedError.code = 'AUTH0_API_ERROR';
      normalizedError.details = error.message;
      return normalizedError;
    }

    const { status, data } = error.response;
    const normalizedError = new Error(data?.message || data?.error_description || 'Auth0 API error');
    normalizedError.statusCode = status;
    normalizedError.code = data?.error || 'AUTH0_API_ERROR';
    normalizedError.details = data;

    return normalizedError;
  }

  /**
   * Search roles with Auth0 Management API
   * @param {object} params - Search parameters
   * @returns {Promise<object>} - Roles search results
   */
  async searchRoles(params = {}) {
    try {
      const response = await retryWithBackoff(async () => {
        return await this.api.get('/roles', { params });
      });

      return response.data;
    } catch (error) {
      throw this.normalizeAuth0Error(error);
    }
  }

  /**
   * Get a role by ID
   * @param {string} roleId - Role ID
   * @returns {Promise<object>} - Role object
   */
  async getRole(roleId) {
    try {
      const response = await retryWithBackoff(async () => {
        return await this.api.get(`/roles/${encodeURIComponent(roleId)}`);
      });

      return response.data;
    } catch (error) {
      throw this.normalizeAuth0Error(error);
    }
  }

  /**
   * Create a new role
   * @param {object} roleData - Role data
   * @returns {Promise<object>} - Created role object
   */
  async createRole(roleData) {
    try {
      const response = await retryWithBackoff(async () => {
        return await this.api.post('/roles', roleData);
      });

      return response.data;
    } catch (error) {
      throw this.normalizeAuth0Error(error);
    }
  }

  /**
   * Update a role
   * @param {string} roleId - Role ID
   * @param {object} roleData - Role data to update
   * @returns {Promise<object>} - Updated role object
   */
  async updateRole(roleId, roleData) {
    try {
      const response = await retryWithBackoff(async () => {
        return await this.api.patch(`/roles/${encodeURIComponent(roleId)}`, roleData);
      });

      return response.data;
    } catch (error) {
      throw this.normalizeAuth0Error(error);
    }
  }

  /**
   * Delete a role
   * @param {string} roleId - Role ID
   * @returns {Promise<void>}
   */
  async deleteRole(roleId) {
    try {
      await retryWithBackoff(async () => {
        return await this.api.delete(`/roles/${encodeURIComponent(roleId)}`);
      });
    } catch (error) {
      throw this.normalizeAuth0Error(error);
    }
  }

  /**
   * Search for a role by name (for idempotent create)
   * @param {string} name - Role name
   * @returns {Promise<object|null>} - Role object if found, null otherwise
   */
  async findRoleByName(name) {
    try {
      const results = await this.searchRoles({
        name_filter: name,
      });

      return results.roles && results.roles.length > 0 ? results.roles[0] : null;
    } catch (error) {
      // If search fails, return null to allow create to proceed
      console.warn('Failed to search for existing role by name:', error.message);
      return null;
    }
  }

  /**
   * Assign permissions to a role
   * @param {string} roleId - Role ID
   * @param {Array} permissions - Array of permission objects
   * @returns {Promise<void>}
   */
  async assignRolePermissions(roleId, permissions) {
    try {
      await retryWithBackoff(async () => {
        return await this.api.post(`/roles/${encodeURIComponent(roleId)}/permissions`, {
          permissions,
        });
      });
    } catch (error) {
      throw this.normalizeAuth0Error(error);
    }
  }

  /**
   * Remove permissions from a role
   * @param {string} roleId - Role ID
   * @param {Array} permissions - Array of permission objects
   * @returns {Promise<void>}
   */
  async removeRolePermissions(roleId, permissions) {
    try {
      await retryWithBackoff(async () => {
        return await this.api.delete(`/roles/${encodeURIComponent(roleId)}/permissions`, {
          data: { permissions },
        });
      });
    } catch (error) {
      throw this.normalizeAuth0Error(error);
    }
  }

  /**
   * Get roles assigned to a user
   * @param {string} userId - User ID
   * @returns {Promise<Array>} - Array of role objects
   */
  async getUserRoles(userId) {
    try {
      const response = await retryWithBackoff(async () => {
        return await this.api.get(`/users/${encodeURIComponent(userId)}/roles`);
      });

      return response.data;
    } catch (error) {
      throw this.normalizeAuth0Error(error);
    }
  }

  /**
   * Assign roles to a user
   * @param {string} userId - User ID
   * @param {Array} roleIds - Array of role IDs
   * @returns {Promise<void>}
   */
  async assignUserRoles(userId, roleIds) {
    try {
      await retryWithBackoff(async () => {
        return await this.api.post(`/users/${encodeURIComponent(userId)}/roles`, {
          roles: roleIds,
        });
      });
    } catch (error) {
      throw this.normalizeAuth0Error(error);
    }
  }

  /**
   * Remove roles from a user
   * @param {string} userId - User ID
   * @param {Array} roleIds - Array of role IDs
   * @returns {Promise<void>}
   */
  async removeUserRoles(userId, roleIds) {
    try {
      await retryWithBackoff(async () => {
        return await this.api.delete(`/users/${encodeURIComponent(userId)}/roles`, {
          data: { roles: roleIds },
        });
      });
    } catch (error) {
      throw this.normalizeAuth0Error(error);
    }
  }

  /**
   * Get service health information
   * @returns {Promise<object>} - Health status
   */
  async getHealth() {
    try {
      const token = await this.getValidToken();
      const cacheStats = tokenCache.getStats();
      
      return {
        status: 'healthy',
        tokenCached: !!token,
        cacheStats,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        cacheStats: tokenCache.getStats(),
      };
    }
  }
}

export default new Auth0Service();