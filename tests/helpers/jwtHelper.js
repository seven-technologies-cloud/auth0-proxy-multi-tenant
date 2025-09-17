const jwt = require('jsonwebtoken');
const config = require('../../src/config');

class JWTHelper {
  /**
   * Generate a JWT token for testing
   */
  static generateToken(payload = {}, options = {}) {
    const defaultPayload = {
      sub: 'test_user_123',
      email: 'test@example.com',
      name: 'Test User',
      tenant_id: 'test_tenant_123',
      tenant_domain: 'test-tenant.auth0.com',
      roles: ['user'],
      permissions: [],
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (60 * 60), // 1 hour
      aud: config.auth0.master.audience,
      iss: `https://${config.auth0.master.domain}/`,
    };

    const tokenPayload = { ...defaultPayload, ...payload };
    const tokenOptions = {
      algorithm: 'HS256',
      ...options,
    };

    return jwt.sign(tokenPayload, config.jwt.secret, tokenOptions);
  }

  /**
   * Generate a master admin token
   */
  static generateMasterAdminToken(overrides = {}) {
    return this.generateToken({
      sub: 'master_admin_123',
      email: 'admin@master.com',
      name: 'Master Admin',
      tenant_id: 'master',
      tenant_domain: config.auth0.master.domain,
      roles: ['master_admin', 'admin'],
      permissions: ['read:all', 'write:all', 'delete:all'],
      isMasterAdmin: true,
      ...overrides,
    });
  }

  /**
   * Generate a tenant admin token
   */
  static generateTenantAdminToken(tenantId = 'test_tenant_123', overrides = {}) {
    return this.generateToken({
      sub: 'tenant_admin_123',
      email: 'admin@tenant.com',
      name: 'Tenant Admin',
      tenant_id: tenantId,
      tenant_domain: `${tenantId}.auth0.com`,
      roles: ['tenant_admin', 'admin'],
      permissions: ['read:users', 'write:users', 'delete:users'],
      isMasterAdmin: false,
      ...overrides,
    });
  }

  /**
   * Generate a regular user token
   */
  static generateUserToken(tenantId = 'test_tenant_123', overrides = {}) {
    return this.generateToken({
      sub: 'regular_user_123',
      email: 'user@tenant.com',
      name: 'Regular User',
      tenant_id: tenantId,
      tenant_domain: `${tenantId}.auth0.com`,
      roles: ['user'],
      permissions: ['read:profile'],
      isMasterAdmin: false,
      ...overrides,
    });
  }

  /**
   * Generate an expired token
   */
  static generateExpiredToken(payload = {}) {
    return this.generateToken({
      ...payload,
      iat: Math.floor(Date.now() / 1000) - (60 * 60 * 2), // 2 hours ago
      exp: Math.floor(Date.now() / 1000) - (60 * 60), // 1 hour ago (expired)
    });
  }

  /**
   * Generate an invalid token (wrong secret)
   */
  static generateInvalidToken(payload = {}) {
    const defaultPayload = {
      sub: 'test_user_123',
      email: 'test@example.com',
      name: 'Test User',
      tenant_id: 'test_tenant_123',
      roles: ['user'],
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (60 * 60),
    };

    const tokenPayload = { ...defaultPayload, ...payload };
    return jwt.sign(tokenPayload, 'wrong_secret', { algorithm: 'HS256' });
  }

  /**
   * Generate a malformed token
   */
  static generateMalformedToken() {
    return 'invalid.jwt.token';
  }

  /**
   * Decode a token without verification (for testing)
   */
  static decodeToken(token) {
    return jwt.decode(token, { complete: true });
  }

  /**
   * Verify a token (for testing)
   */
  static verifyToken(token, secret = config.jwt.secret) {
    try {
      return jwt.verify(token, secret);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Generate token with custom claims
   */
  static generateTokenWithClaims(claims = {}) {
    return this.generateToken(claims);
  }

  /**
   * Generate token for specific tenant
   */
  static generateTenantToken(tenantId, role = 'user', overrides = {}) {
    const rolePermissions = {
      user: ['read:profile'],
      admin: ['read:users', 'write:users'],
      tenant_admin: ['read:users', 'write:users', 'delete:users'],
      master_admin: ['read:all', 'write:all', 'delete:all'],
    };

    return this.generateToken({
      sub: `${role}_${tenantId}_123`,
      email: `${role}@${tenantId}.com`,
      name: `${role.charAt(0).toUpperCase() + role.slice(1)} User`,
      tenant_id: tenantId,
      tenant_domain: `${tenantId}.auth0.com`,
      roles: [role],
      permissions: rolePermissions[role] || ['read:profile'],
      isMasterAdmin: role === 'master_admin',
      ...overrides,
    });
  }

  /**
   * Generate Authorization header
   */
  static generateAuthHeader(token) {
    return `Bearer ${token}`;
  }

  /**
   * Generate multiple tokens for testing
   */
  static generateTestTokens() {
    return {
      masterAdmin: this.generateMasterAdminToken(),
      tenantAdmin: this.generateTenantAdminToken(),
      regularUser: this.generateUserToken(),
      expiredToken: this.generateExpiredToken(),
      invalidToken: this.generateInvalidToken(),
      malformedToken: this.generateMalformedToken(),
    };
  }
}

module.exports = JWTHelper;