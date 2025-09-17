const logger = require('../utils/logger');
const {
  AuthorizationError,
  InsufficientPermissionsError,
  UnauthorizedTenantAccessError,
} = require('../utils/errors');

class AuthorizationMiddleware {
  /**
   * Check if user has required roles (Not applicable for M2M API)
   * This method is kept for compatibility but always passes for M2M clients
   */
  static requireRoles(requiredRoles) {
    return (req, res, next) => {
      try {
        if (!req.user) {
          const { AuthenticationError } = require('../utils/errors');
          throw new AuthenticationError('Authentication required');
        }

        // For M2M API, role-based authorization is not applicable
        // All authorization is based on master client status
        logger.info('Role authorization skipped for M2M client:', {
          clientId: req.user.sub,
          isMasterClient: req.user.isMasterClient,
        });

        next();
      } catch (error) {
        logger.error('Role authorization failed:', error);
        next(error);
      }
    };
  }

  /**
   * Check if user has required permissions (Not applicable for M2M API)
   * This method is kept for compatibility but always passes for M2M clients
   */
  static requirePermissions(requiredPermissions) {
    return (req, res, next) => {
      try {
        if (!req.user) {
          const { AuthenticationError } = require('../utils/errors');
          throw new AuthenticationError('Authentication required');
        }

        // For M2M API, permission-based authorization is not applicable
        // All authorization is based on master client status
        logger.info('Permission authorization skipped for M2M client:', {
          clientId: req.user.sub,
          isMasterClient: req.user.isMasterClient,
        });

        next();
      } catch (error) {
        logger.error('Permission authorization failed:', error);
        next(error);
      }
    };
  }

  /**
   * Require master client access (M2M)
   */
  static requireMasterAdmin() {
    return (req, res, next) => {
      try {
        if (!req.user) {
          const { AuthenticationError } = require('../utils/errors');
          throw new AuthenticationError('Authentication required');
        }

        // For M2M API, check if client is master client
        const isMasterClient = req.user.isMasterClient || req.user.isM2M;

        if (!isMasterClient) {
          logger.warn('Master client access denied:', {
            clientId: req.user.client_id || req.user.sub,
            tenantDomain: req.user.tenant_domain,
            isM2M: req.user.isM2M,
            grantType: req.user.gty,
          });

          throw new AuthorizationError('Master client access required', {
            clientId: req.user.client_id || req.user.sub,
            grantType: req.user.gty,
          });
        }

        logger.info('Master client authorization successful:', {
          clientId: req.user.client_id || req.user.sub,
          grantType: req.user.gty,
        });

        next();
      } catch (error) {
        logger.error('Master client authorization failed:', error);
        next(error);
      }
    };
  }

  /**
   * Require tenant admin role (Simplified for M2M API)
   * For M2M API, this is equivalent to requiring master client access
   */
  static requireTenantAdmin() {
    return (req, res, next) => {
      try {
        if (!req.user) {
          const { AuthenticationError } = require('../utils/errors');
          throw new AuthenticationError('Authentication required');
        }

        // For M2M API, only master clients can perform tenant admin operations
        if (!req.user.isMasterClient) {
          logger.warn('Tenant admin access denied for non-master client:', {
            clientId: req.user.sub,
            isMasterClient: req.user.isMasterClient,
          });

          throw new AuthorizationError('Master client access required for tenant operations');
        }

        logger.info('Tenant admin authorization successful:', {
          clientId: req.user.sub,
          isMasterClient: req.user.isMasterClient,
        });

        next();
      } catch (error) {
        logger.error('Tenant admin authorization failed:', error);
        next(error);
      }
    };
  }

  /**
   * Check if user can access specific tenant
   */
  static requireTenantAccess(tenantIdParam = 'tenantId') {
    return (req, res, next) => {
      try {
        if (!req.user) {
          const { AuthenticationError } = require('../utils/errors');
          throw new AuthenticationError('Authentication required');
        }

        const requestedTenantId = req.params[tenantIdParam];
        
        // Master admins can access any tenant
        const isMasterAdmin = req.user.isMasterClient || req.user.isM2M || 
                             (req.user.roles && req.user.roles.includes('master_admin'));
        
        if (isMasterAdmin) {
          logger.info('Master admin tenant access granted:', {
            userId: req.user.sub,
            requestedTenantId,
          });
          return next();
        }

        // Regular users can only access their own tenant
        if (req.user.tenant_id !== requestedTenantId) {
          logger.warn('Tenant access denied:', {
            userId: req.user.sub,
            userTenantId: req.user.tenant_id,
            requestedTenantId,
          });

          throw new UnauthorizedTenantAccessError(requestedTenantId, {
            userId: req.user.sub,
            userTenantId: req.user.tenant_id,
          });
        }

        logger.info('Tenant access authorized:', {
          userId: req.user.sub,
          tenantId: requestedTenantId,
        });

        next();
      } catch (error) {
        logger.error('Tenant access authorization failed:', error);
        next(error);
      }
    };
  }

  /**
   * Check if user can manage users (Simplified for M2M API)
   * For M2M API, only master clients can manage users
   */
  static requireUserManagement() {
    return (req, res, next) => {
      try {
        if (!req.user) {
          const { AuthenticationError } = require('../utils/errors');
          throw new AuthenticationError('Authentication required');
        }

        // For M2M API, only master clients can manage users
        if (!req.user.isMasterClient) {
          logger.warn('User management access denied for non-master client:', {
            clientId: req.user.sub,
            isMasterClient: req.user.isMasterClient,
          });

          throw new AuthorizationError('Master client access required for user management');
        }

        logger.info('User management authorization successful:', {
          clientId: req.user.sub,
          isMasterClient: req.user.isMasterClient,
        });

        next();
      } catch (error) {
        logger.error('User management authorization failed:', error);
        next(error);
      }
    };
  }

  /**
   * Check if user can access their own profile or manage others (Simplified for M2M API)
   * For M2M API, only master clients can access user profiles
   */
  static requireSelfOrManagement(userIdParam = 'userId') {
    return (req, res, next) => {
      try {
        if (!req.user) {
          const { AuthenticationError } = require('../utils/errors');
          throw new AuthenticationError('Authentication required');
        }

        // For M2M API, only master clients can access user profiles
        if (!req.user.isMasterClient) {
          logger.warn('User access denied for non-master client:', {
            clientId: req.user.sub,
            requestedUserId: req.params[userIdParam],
            isMasterClient: req.user.isMasterClient,
          });

          throw new AuthorizationError('Master client access required for user profile access');
        }

        logger.info('User access authorized for master client:', {
          clientId: req.user.sub,
          requestedUserId: req.params[userIdParam],
        });

        next();
      } catch (error) {
        logger.error('User access authorization failed:', error);
        next(error);
      }
    };
  }

  /**
   * Check if user can perform tenant management operations (Simplified for M2M API)
   * For M2M API, only master clients can manage tenants
   */
  static requireTenantManagement() {
    return (req, res, next) => {
      try {
        if (!req.user) {
          const { AuthenticationError } = require('../utils/errors');
          throw new AuthenticationError('Authentication required');
        }

        // For M2M API, only master clients can manage tenants
        if (!req.user.isMasterClient) {
          logger.warn('Tenant management access denied for non-master client:', {
            clientId: req.user.sub,
            isMasterClient: req.user.isMasterClient,
          });

          throw new AuthorizationError('Master client access required for tenant management');
        }

        logger.info('Tenant management authorization successful:', {
          clientId: req.user.sub,
        });

        next();
      } catch (error) {
        logger.error('Tenant management authorization failed:', error);
        next(error);
      }
    };
  }

  /**
   * Conditional authorization based on operation type
   */
  static conditionalAuth(conditions) {
    return (req, res, next) => {
      try {
        if (!req.user) {
          const { AuthenticationError } = require('../utils/errors');
          throw new AuthenticationError('Authentication required');
        }

        const method = req.method.toLowerCase();
        const condition = conditions[method];

        if (!condition) {
          // No specific condition for this method, allow
          return next();
        }

        // Apply the condition
        if (typeof condition === 'function') {
          return condition(req, res, next);
        } else if (Array.isArray(condition)) {
          // Assume it's a list of required roles
          return AuthorizationMiddleware.requireRoles(condition)(req, res, next);
        }

        next();
      } catch (error) {
        logger.error('Conditional authorization failed:', error);
        next(error);
      }
    };
  }

  /**
   * Rate limiting based on user role
   */
  static roleBasedRateLimit() {
    return (req, res, next) => {
      try {
        if (!req.user) {
          // No user, apply default rate limiting
          return next();
        }

        const userRoles = req.user.roles || [];
        
        // Set rate limit info based on role
        if (req.user.isMasterClient || req.user.isM2M || userRoles.includes('master_admin')) {
          req.rateLimitTier = 'master';
        } else if (userRoles.includes('tenant_admin') || userRoles.includes('admin')) {
          req.rateLimitTier = 'admin';
        } else {
          req.rateLimitTier = 'user';
        }

        next();
      } catch (error) {
        logger.error('Role-based rate limiting failed:', error);
        next(error);
      }
    };
  }

  /**
   * Audit logging for sensitive operations
   */
  static auditSensitiveOperation(operationType) {
    return (req, res, next) => {
      try {
        if (req.user) {
          logger.audit(operationType, 'api_access', req.user, {
            method: req.method,
            url: req.url,
            params: req.params,
            query: req.query,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
          });
        }

        next();
      } catch (error) {
        logger.error('Audit logging failed:', error);
        // Don't fail the request for audit logging errors
        next();
      }
    };
  }
}

module.exports = AuthorizationMiddleware;