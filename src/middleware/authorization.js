const logger = require('../utils/logger');
const {
  AuthorizationError,
  InsufficientPermissionsError,
  UnauthorizedTenantAccessError,
} = require('../utils/errors');

class AuthorizationMiddleware {
  /**
   * Check if user has required roles
   */
  static requireRoles(requiredRoles) {
    return (req, res, next) => {
      try {
        if (!req.user) {
          // No authenticated user -> this is actually an authentication problem
          const { AuthenticationError } = require('../utils/errors');
          throw new AuthenticationError('Authentication required');
        }

        const userRoles = req.user.roles || [];
        const hasRequiredRole = requiredRoles.some(role => userRoles.includes(role));

        if (!hasRequiredRole) {
          logger.warn('Insufficient roles:', {
            userId: req.user.sub,
            userRoles,
            requiredRoles,
          });

          throw new InsufficientPermissionsError(requiredRoles, {
            userRoles,
            userId: req.user.sub,
          });
        }

        logger.info('Role authorization successful:', {
          userId: req.user.sub,
          userRoles,
          requiredRoles,
        });

        next();
      } catch (error) {
        logger.error('Role authorization failed:', error);
        next(error);
      }
    };
  }

  /**
   * Check if user has required permissions
   */
  static requirePermissions(requiredPermissions) {
    return (req, res, next) => {
      try {
        if (!req.user) {
          // No authenticated user -> treat as authentication error
          const { AuthenticationError } = require('../utils/errors');
          throw new AuthenticationError('Authentication required');
        }

        const userPermissions = req.user.permissions || [];
        const hasAllPermissions = requiredPermissions.every(permission => 
          userPermissions.includes(permission)
        );

        if (!hasAllPermissions) {
          logger.warn('Insufficient permissions:', {
            userId: req.user.sub,
            userPermissions,
            requiredPermissions,
          });

          throw new InsufficientPermissionsError(requiredPermissions, {
            userPermissions,
            userId: req.user.sub,
          });
        }

        logger.info('Permission authorization successful:', {
          userId: req.user.sub,
          userPermissions,
          requiredPermissions,
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
   * Require tenant admin role (for tenant-specific operations)
   */
  static requireTenantAdmin() {
    return (req, res, next) => {
      try {
        if (!req.user) {
          const { AuthenticationError } = require('../utils/errors');
          throw new AuthenticationError('Authentication required');
        }

        const userRoles = req.user.roles || [];
        const isTenantAdmin = userRoles.includes('tenant_admin') || userRoles.includes('admin');
        const isMasterAdmin = req.user.isMasterClient || req.user.isM2M || userRoles.includes('master_admin');

        if (!isTenantAdmin && !isMasterAdmin) {
          logger.warn('Tenant admin access denied:', {
            userId: req.user.sub,
            roles: userRoles,
            tenantId: req.user.tenant_id,
          });

          throw new InsufficientPermissionsError(['tenant_admin', 'admin'], {
            userId: req.user.sub,
            currentRoles: userRoles,
          });
        }

        logger.info('Tenant admin authorization successful:', {
          userId: req.user.sub,
          isTenantAdmin,
          isMasterAdmin,
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
   * Check if user can manage users (create, update, delete)
   */
  static requireUserManagement() {
    return (req, res, next) => {
      try {
        if (!req.user) {
          const { AuthenticationError } = require('../utils/errors');
          throw new AuthenticationError('Authentication required');
        }

        const userRoles = req.user.roles || [];
        const canManageUsers = userRoles.includes('tenant_admin') || 
                              userRoles.includes('admin') || 
                              userRoles.includes('user_manager') ||
                              req.user.isMasterClient || 
                              req.user.isM2M ||
                              userRoles.includes('master_admin');

        if (!canManageUsers) {
          logger.warn('User management access denied:', {
            userId: req.user.sub,
            roles: userRoles,
          });

          throw new InsufficientPermissionsError(['tenant_admin', 'admin', 'user_manager'], {
            userId: req.user.sub,
            currentRoles: userRoles,
          });
        }

        logger.info('User management authorization successful:', {
          userId: req.user.sub,
          roles: userRoles,
        });

        next();
      } catch (error) {
        logger.error('User management authorization failed:', error);
        next(error);
      }
    };
  }

  /**
   * Check if user can access their own profile or manage others
   */
  static requireSelfOrManagement(userIdParam = 'userId') {
    return (req, res, next) => {
      try {
        if (!req.user) {
          const { AuthenticationError } = require('../utils/errors');
          throw new AuthenticationError('Authentication required');
        }

        const requestedUserId = req.params[userIdParam];
        const currentUserId = req.user.sub;
        
        // Users can always access their own profile
        if (requestedUserId === currentUserId) {
          logger.info('Self-access authorized:', {
            userId: currentUserId,
          });
          return next();
        }

        // Check if user has management permissions
        const userRoles = req.user.roles || [];
        const canManageUsers = userRoles.includes('tenant_admin') || 
                              userRoles.includes('admin') || 
                              userRoles.includes('user_manager') ||
                              req.user.isMasterClient ||
                              req.user.isM2M ||
                              userRoles.includes('master_admin');

        if (!canManageUsers) {
          logger.warn('User access denied:', {
            currentUserId,
            requestedUserId,
            roles: userRoles,
          });

          throw new AuthorizationError('Cannot access other user profiles', {
            currentUserId,
            requestedUserId,
            currentRoles: userRoles,
          });
        }

        logger.info('User management access authorized:', {
          currentUserId,
          requestedUserId,
          roles: userRoles,
        });

        next();
      } catch (error) {
        logger.error('User access authorization failed:', error);
        next(error);
      }
    };
  }

  /**
   * Check if user can perform tenant management operations
   */
  static requireTenantManagement() {
    return (req, res, next) => {
      try {
        if (!req.user) {
          const { AuthenticationError } = require('../utils/errors');
          throw new AuthenticationError('Authentication required');
        }

        // Only master admins can manage tenants
        const isMasterAdmin = req.user.isMasterClient || req.user.isM2M || 
                             (req.user.roles && req.user.roles.includes('master_admin'));

        if (!isMasterAdmin) {
          logger.warn('Tenant management access denied:', {
            userId: req.user.sub,
            roles: req.user.roles,
          });

          throw new AuthorizationError('Tenant management requires master admin access', {
            userId: req.user.sub,
            currentRoles: req.user.roles,
          });
        }

        logger.info('Tenant management authorization successful:', {
          userId: req.user.sub,
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