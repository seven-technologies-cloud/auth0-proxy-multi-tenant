const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');
const config = require('../config');
const logger = require('../utils/logger');
const {
  InvalidTokenError,
  MissingTokenError,
  AuthenticationError,
} = require('../utils/errors');

class AuthMiddleware {
  constructor() {
    this.jwksClients = new Map();
    this.initializeJwksClients();
  }

  /**
   * Initialize JWKS clients for different Auth0 tenants
   */
  initializeJwksClients() {
    // Master tenant JWKS client
    const masterJwksClient = jwksClient({
      jwksUri: `https://${config.auth0.master.domain}/.well-known/jwks.json`,
      requestHeaders: {},
      timeout: 30000,
      cache: true,
      cacheMaxEntries: 5,
      cacheMaxAge: 10 * 60 * 1000, // 10 minutes
      rateLimit: true,
      jwksRequestsPerMinute: 10,
    });

    this.jwksClients.set('master', masterJwksClient);
    logger.info('JWKS clients initialized');
  }

  /**
   * Get JWKS client for a specific tenant
   */
  getJwksClient(tenantDomain) {
    // Check if we have a client for this tenant
    if (!this.jwksClients.has(tenantDomain)) {
      // Create new JWKS client for this tenant
      const client = jwksClient({
        jwksUri: `https://${tenantDomain}/.well-known/jwks.json`,
        requestHeaders: {},
        timeout: 30000,
        cache: true,
        cacheMaxEntries: 5,
        cacheMaxAge: 10 * 60 * 1000, // 10 minutes
        rateLimit: true,
        jwksRequestsPerMinute: 10,
      });

      this.jwksClients.set(tenantDomain, client);
      logger.info('Created JWKS client for tenant:', tenantDomain);
    }

    return this.jwksClients.get(tenantDomain);
  }

  /**
   * Get signing key for JWT verification
   */
  async getSigningKey(header, tenantDomain) {
    try {
      const client = this.getJwksClient(tenantDomain);
      
      return new Promise((resolve, reject) => {
        client.getSigningKey(header.kid, (err, key) => {
          if (err) {
            logger.error('Failed to get signing key:', err);
            reject(new AuthenticationError('Failed to verify token signature'));
          } else {
            const signingKey = key.publicKey || key.rsaPublicKey;
            resolve(signingKey);
          }
        });
      });
    } catch (error) {
      logger.error('Error getting signing key:', error);
      throw new AuthenticationError('Failed to verify token signature');
    }
  }

  /**
   * Extract token from request
   */
  extractToken(req) {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      throw new MissingTokenError('Authorization header is required');
    }

    const parts = authHeader.split(' ');
    
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      throw new InvalidTokenError('Authorization header must be in format: Bearer <token>');
    }

    return parts[1];
  }

  /**
   * Determine tenant domain from token
   */
  async determineTenantDomain(token) {
    try {
      // Decode token without verification to get issuer
      const decoded = jwt.decode(token, { complete: true });
      
      if (!decoded || !decoded.payload || !decoded.payload.iss) {
        throw new InvalidTokenError('Invalid token format');
      }

      // Extract domain from issuer URL
      const issuer = decoded.payload.iss;
      const domainMatch = issuer.match(/https:\/\/([^\/]+)/);
      
      if (!domainMatch) {
        throw new InvalidTokenError('Invalid token issuer');
      }

      return domainMatch[1];
    } catch (error) {
      if (error instanceof InvalidTokenError) {
        throw error;
      }
      logger.error('Failed to determine tenant domain:', error);
      throw new InvalidTokenError('Failed to parse token');
    }
  }

  /**
   * Verify JWT token
   */
  async verifyToken(token, tenantDomain) {
    try {
      // Test/mock mode: verify HS256 with shared secret to work with test tokens
      if (process.env.MOCK_AUTH0_API === 'true') {
        try {
          return jwt.verify(token, config.jwt.secret, {
            algorithms: ['HS256'],
            audience: config.auth0.master.audience,
            issuer: `https://${tenantDomain}/`,
          });
        } catch (err) {
          logger.error('JWT verification failed (mock mode):', err);
          if (err.name === 'TokenExpiredError') {
            throw new InvalidTokenError('Token has expired');
          } else if (err.name === 'JsonWebTokenError') {
            throw new InvalidTokenError('Invalid token');
          }
          throw new InvalidTokenError('Token verification failed');
        }
      }

      // Production mode: verify RS256 with JWKS
      return new Promise(async (resolve, reject) => {
        // Decode token to get header
        const decoded = jwt.decode(token, { complete: true });
        
        if (!decoded || !decoded.header) {
          return reject(new InvalidTokenError('Invalid token format'));
        }

        try {
          // Get signing key
          const signingKey = await this.getSigningKey(decoded.header, tenantDomain);

          // Verify token
          jwt.verify(token, signingKey, {
            audience: config.auth0.master.audience,
            issuer: `https://${tenantDomain}/`,
            algorithms: ['RS256'],
          }, (err, decodedToken) => {
            if (err) {
              logger.error('JWT verification failed:', err);
              
              if (err.name === 'TokenExpiredError') {
                return reject(new InvalidTokenError('Token has expired'));
              } else if (err.name === 'JsonWebTokenError') {
                return reject(new InvalidTokenError('Invalid token'));
              } else {
                return reject(new InvalidTokenError('Token verification failed'));
              }
            }

            resolve(decodedToken);
          });
        } catch (keyError) {
          reject(keyError);
        }
      });
    } catch (error) {
      logger.error('Token verification error:', error);
      throw error;
    }
  }

  /**
   * Enhance M2M client object with additional information
   */
  enhanceUserObject(decodedToken, tenantDomain) {
    return {
      sub: decodedToken.sub, // Client ID for M2M
      client_id: decodedToken.azp || decodedToken.sub,
      tenant_domain: tenantDomain,
      scope: decodedToken.scope,
      iat: decodedToken.iat,
      exp: decodedToken.exp,
      aud: decodedToken.aud,
      iss: decodedToken.iss,
      gty: decodedToken.gty, // Grant type (should be 'client-credentials' for M2M)
      isMasterClient: this.isMasterTenant(tenantDomain),
      // M2M tokens don't have user info like email, name, picture
      isM2M: true,
    };
  }

  /**
   * Check if tenant is the master tenant
   */
  isMasterTenant(tenantDomain) {
    return tenantDomain === config.auth0.master.domain;
  }

  /**
   * Main authentication middleware
   */
  authenticate() {
    return async (req, res, next) => {
      try {
        logger.info('Authenticating request:', {
          method: req.method,
          url: req.url,
          ip: req.ip,
        });

        // Extract token
        const token = this.extractToken(req);

        // Determine tenant domain
        const tenantDomain = await this.determineTenantDomain(token);

        // Verify token
        const decodedToken = await this.verifyToken(token, tenantDomain);

        // Enhance user object
        const user = this.enhanceUserObject(decodedToken, tenantDomain);

        // Attach user to request
        req.user = user;
        req.token = token;
        req.tenantDomain = tenantDomain;

        logger.info('M2M Authentication successful:', {
          clientId: user.client_id,
          tenantDomain,
          scope: user.scope,
          grantType: user.gty,
        });

        next();
      } catch (error) {
        logger.error('Authentication failed:', error);
        logger.logError(error, req);
        next(error);
      }
    };
  }

  /**
   * Optional authentication middleware (doesn't fail if no token)
   */
  optionalAuthenticate() {
    return async (req, res, next) => {
      try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader) {
          // No token provided, continue without authentication
          return next();
        }

        // Use regular authentication
        return this.authenticate()(req, res, next);
      } catch (error) {
        // Log error but don't fail the request
        logger.warn('Optional authentication failed:', error);
        next();
      }
    };
  }

  /**
   * Middleware to require master tenant authentication
   */
  requireMasterTenant() {
    return async (req, res, next) => {
      try {
        if (!req.user) {
          throw new AuthenticationError('Authentication required');
        }

        if (!req.user.isMasterClient) {
          throw new AuthenticationError('Master tenant M2M access required');
        }

        next();
      } catch (error) {
        logger.error('Master tenant authentication failed:', error);
        next(error);
      }
    };
  }

  /**
   * Middleware to validate tenant access
   */
  validateTenantAccess(tenantIdParam = 'tenantId') {
    return async (req, res, next) => {
      try {
        if (!req.user) {
          throw new AuthenticationError('Authentication required');
        }

        const requestedTenantId = req.params[tenantIdParam];
        
        // Master M2M clients can access any tenant
        if (req.user.isMasterClient) {
          return next();
        }

        // For M2M-only API, we primarily use master client
        // Additional tenant-specific validation can be added here if needed
        throw new AuthenticationError(
          `M2M access validation failed for tenant: ${requestedTenantId}`,
          {
            clientId: req.user.client_id,
            requestedTenantId,
          }
        );

        next();
      } catch (error) {
        logger.error('Tenant access validation failed:', error);
        next(error);
      }
    };
  }

  /**
   * Create middleware instance
   */
  static create() {
    const authMiddleware = new AuthMiddleware();
    
    return {
      authenticate: authMiddleware.authenticate.bind(authMiddleware),
      optionalAuthenticate: authMiddleware.optionalAuthenticate.bind(authMiddleware),
      requireMasterTenant: authMiddleware.requireMasterTenant.bind(authMiddleware),
      validateTenantAccess: authMiddleware.validateTenantAccess.bind(authMiddleware),
    };
  }
}

// Export middleware instance
module.exports = AuthMiddleware.create();