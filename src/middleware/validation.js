const Joi = require('joi');
const logger = require('../utils/logger');
const { ValidationError } = require('../utils/errors');

class ValidationMiddleware {
  /**
   * Validate request body
   */
  static validateBody(schema) {
    return (req, res, next) => {
      try {
        const { error, value } = schema.validate(req.body, {
          abortEarly: false,
          stripUnknown: true,
          allowUnknown: false,
        });

        if (error) {
          const validationErrors = error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message,
            value: detail.context?.value,
          }));

          logger.warn('Request body validation failed:', {
            url: req.url,
            method: req.method,
            errors: validationErrors,
          });

          throw new ValidationError('Request body validation failed', {
            validationErrors,
          });
        }

        // Replace req.body with validated and sanitized data
        Object.assign(req.body, value);
        next();
      } catch (err) {
        next(err);
      }
    };
  }

  /**
   * Validate request query parameters
   */
  static validateQuery(schema) {
    return (req, res, next) => {
      try {
        const { error, value } = schema.validate(req.query, {
          abortEarly: false,
          stripUnknown: true,
          allowUnknown: false,
        });

        if (error) {
          const validationErrors = error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message,
            value: detail.context?.value,
          }));

          logger.warn('Request query validation failed:', {
            url: req.url,
            method: req.method,
            errors: validationErrors,
          });

          throw new ValidationError('Request query validation failed', {
            validationErrors,
          });
        }

        // Replace req.query with validated and sanitized data
        // Note: req.query might be read-only, so we use Object.assign
        Object.assign(req.query, value);
        next();
      } catch (err) {
        next(err);
      }
    };
  }

  /**
   * Validate request parameters
   */
  static validateParams(schema) {
    return (req, res, next) => {
      try {
        const { error, value } = schema.validate(req.params, {
          abortEarly: false,
          stripUnknown: true,
          allowUnknown: false,
        });

        if (error) {
          const validationErrors = error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message,
            value: detail.context?.value,
          }));

          logger.warn('Request params validation failed:', {
            url: req.url,
            method: req.method,
            errors: validationErrors,
          });

          throw new ValidationError('Request parameters validation failed', {
            validationErrors,
          });
        }

        // Replace req.params with validated and sanitized data
        Object.assign(req.params, value);
        next();
      } catch (err) {
        next(err);
      }
    };
  }

  /**
   * Validate multiple parts of the request
   */
  static validate(schemas) {
    return (req, res, next) => {
      try {
        const errors = [];

        // Validate body
        if (schemas.body) {
          const { error, value } = schemas.body.validate(req.body, {
            abortEarly: false,
            stripUnknown: true,
            allowUnknown: false,
          });

          if (error) {
            errors.push(...error.details.map(detail => ({
              location: 'body',
              field: detail.path.join('.'),
              message: detail.message,
              value: detail.context?.value,
            })));
          } else {
            Object.assign(req.body, value);
          }
        }

        // Validate query
        if (schemas.query) {
          const { error, value } = schemas.query.validate(req.query, {
            abortEarly: false,
            stripUnknown: true,
            allowUnknown: false,
          });

          if (error) {
            errors.push(...error.details.map(detail => ({
              location: 'query',
              field: detail.path.join('.'),
              message: detail.message,
              value: detail.context?.value,
            })));
          } else {
            req.query = value;
          }
        }

        // Validate params
        if (schemas.params) {
          const { error, value } = schemas.params.validate(req.params, {
            abortEarly: false,
            stripUnknown: true,
            allowUnknown: false,
          });

          if (error) {
            errors.push(...error.details.map(detail => ({
              location: 'params',
              field: detail.path.join('.'),
              message: detail.message,
              value: detail.context?.value,
            })));
          } else {
            Object.assign(req.params, value);
          }
        }

        if (errors.length > 0) {
          logger.warn('Request validation failed:', {
            url: req.url,
            method: req.method,
            errors,
          });

          throw new ValidationError('Request validation failed', {
            validationErrors: errors,
          });
        }

        next();
      } catch (err) {
        next(err);
      }
    };
  }
}

// Common validation schemas
const ValidationSchemas = {
  // Pagination schemas
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    sortBy: Joi.string().default('createdAt'),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
  }),

  // Search schema
  search: Joi.object({
    search: Joi.string().trim().max(100).optional(),
    status: Joi.string().valid('active', 'inactive', 'suspended', 'blocked', 'pending').optional(),
  }),

  // Tenant schemas
  createTenant: Joi.object({
    name: Joi.string().trim().min(2).max(100).required()
      .messages({
        'string.min': 'Tenant name must be at least 2 characters long',
        'string.max': 'Tenant name cannot exceed 100 characters',
        'any.required': 'Tenant name is required',
      }),
    domain: Joi.string().trim().min(3).max(50).pattern(/^[a-z0-9-]+$/).required()
      .messages({
        'string.pattern.base': 'Domain must contain only lowercase letters, numbers, and hyphens',
        'any.required': 'Domain is required',
      }),
    seatLimit: Joi.number().integer().min(1).max(10000).default(10),
    plan: Joi.string().valid('basic', 'standard', 'premium', 'enterprise').default('standard'),
    industry: Joi.string().trim().max(50).optional(),
    contactEmail: Joi.string().email().optional(),
    allowUserRegistration: Joi.boolean().default(true),
    requireEmailVerification: Joi.boolean().default(true),
    enableMFA: Joi.boolean().default(false),
    sessionTimeout: Joi.number().integer().min(1).max(168).default(24), // hours
    metadata: Joi.object().optional(),
  }),

  updateTenant: Joi.object({
    name: Joi.string().trim().min(2).max(100).optional(),
    seatLimit: Joi.number().integer().min(1).max(10000).optional(),
    status: Joi.string().valid('active', 'inactive', 'suspended').optional(),
    plan: Joi.string().valid('basic', 'standard', 'premium', 'enterprise').optional(),
    industry: Joi.string().trim().max(50).optional(),
    contactEmail: Joi.string().email().optional(),
    allowUserRegistration: Joi.boolean().optional(),
    requireEmailVerification: Joi.boolean().optional(),
    enableMFA: Joi.boolean().optional(),
    sessionTimeout: Joi.number().integer().min(1).max(168).optional(),
    metadata: Joi.object().optional(),
  }).min(1),

  // User schemas
  createUser: Joi.object({
    tenantId: Joi.string().required(), // Required for M2M API
    email: Joi.string().email().required()
      .messages({
        'string.email': 'Please provide a valid email address',
        'any.required': 'Email is required',
      }),
    name: Joi.string().trim().min(2).max(100).required()
      .messages({
        'string.min': 'Name must be at least 2 characters long',
        'any.required': 'Name is required',
      }),
    password: Joi.string().min(8).max(128).optional()
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .messages({
        'string.min': 'Password must be at least 8 characters long',
        'string.pattern.base': 'Password must contain at least one lowercase letter, one uppercase letter, and one number',
      }),
    roles: Joi.array().items(Joi.string().valid('user', 'admin', 'tenant_admin', 'user_manager')).default(['user']),
    email_verified: Joi.boolean().default(false), // Fix field name to match Auth0
    emailVerified: Joi.boolean().default(false), // Keep both for compatibility
    connection: Joi.string().default('Username-Password-Authentication'),
    user_metadata: Joi.object().optional(), // Fix field name to match Auth0
    metadata: Joi.object().optional(), // Keep both for compatibility
    app_metadata: Joi.object().optional(), // Fix field name to match Auth0
    appMetadata: Joi.object().optional(), // Keep both for compatibility
  }),

  updateUser: Joi.object({
    tenantId: Joi.string().required(), // Required for M2M API
    name: Joi.string().trim().min(2).max(100).optional(),
    email: Joi.string().email().optional(),
    password: Joi.string().min(8).max(128).optional()
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .messages({
        'string.pattern.base': 'Password must contain at least one lowercase letter, one uppercase letter, and one number',
      }),
    roles: Joi.array().items(Joi.string().valid('user', 'admin', 'tenant_admin', 'user_manager')).optional(),
    blocked: Joi.boolean().optional(),
    emailVerified: Joi.boolean().optional(),
    metadata: Joi.object().optional(),
    appMetadata: Joi.object().optional(),
  }).min(1),

  // Parameter schemas
  tenantIdParam: Joi.object({
    tenantId: Joi.string().required()
      .messages({
        'any.required': 'Tenant ID is required',
      }),
  }),

  userIdParam: Joi.object({
    userId: Joi.string().required()
      .messages({
        'any.required': 'User ID is required',
      }),
  }),

  // Query schemas for lists
  tenantListQuery: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    search: Joi.string().trim().max(100).optional(),
    status: Joi.string().valid('active', 'inactive', 'suspended').optional(),
    sortBy: Joi.string().valid('name', 'createdAt', 'updatedAt', 'seatUsed').default('createdAt'),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
  }),

  userListQuery: Joi.object({
    tenantId: Joi.string().required(), // Required for M2M API
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    search: Joi.string().trim().max(100).optional(),
    role: Joi.string().valid('user', 'admin', 'tenant_admin', 'user_manager').optional(),
    status: Joi.string().valid('active', 'blocked', 'pending').optional(),
    sortBy: Joi.string().valid('name', 'email', 'createdAt', 'lastLogin').default('createdAt'),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
  }),

  // Role management schemas
  updateUserRoles: Joi.object({
    tenantId: Joi.string().required(), // Required for M2M API
    roles: Joi.array().items(Joi.string().valid('user', 'admin', 'tenant_admin', 'user_manager')).min(1).required()
      .messages({
        'array.min': 'At least one role must be specified',
        'any.required': 'Roles are required',
      }),
  }),

  // Seat management schemas
  updateSeatLimit: Joi.object({
    seatLimit: Joi.number().integer().min(1).max(10000).required()
      .messages({
        'number.min': 'Seat limit must be at least 1',
        'number.max': 'Seat limit cannot exceed 10000',
        'any.required': 'Seat limit is required',
      }),
  }),
};

module.exports = {
  ValidationMiddleware,
  ValidationSchemas,
};