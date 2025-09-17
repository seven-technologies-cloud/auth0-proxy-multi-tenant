const express = require('express');
const TenantService = require('../services/tenantService');
const auth = require('../middleware/auth');
const AuthorizationMiddleware = require('../middleware/authorization');
const { ValidationMiddleware, ValidationSchemas } = require('../middleware/validation');
const ErrorHandler = require('../middleware/errorHandler');
const logger = require('../utils/logger');

const router = express.Router();
const tenantService = new TenantService();

/**
 * @route GET /api/tenants
 * @desc Get all tenants (Master tenant only)
 * @access Private (Master Admin)
 */
router.get('/',
  auth.authenticate(),
  AuthorizationMiddleware.requireMasterAdmin(),
  ValidationMiddleware.validateQuery(ValidationSchemas.tenantListQuery),
  AuthorizationMiddleware.auditSensitiveOperation('tenant_list'),
  ErrorHandler.asyncHandler(async (req, res) => {
    logger.info('Getting all tenants', {
      requestedBy: req.user.sub,
      filters: req.query,
    });

    const result = await tenantService.getTenants(req.query, req.user);

    res.json({
      success: true,
      data: result,
      message: `Retrieved ${result.tenants.length} tenants`,
    });
  })
);

/**
 * @route POST /api/tenants
 * @desc Create a new tenant (Master tenant only)
 * @access Private (Master Admin)
 */
router.post('/',
  auth.authenticate(),
  AuthorizationMiddleware.requireMasterAdmin(),
  ValidationMiddleware.validateBody(ValidationSchemas.createTenant),
  AuthorizationMiddleware.auditSensitiveOperation('tenant_create'),
  ErrorHandler.asyncHandler(async (req, res) => {
    logger.info('Creating new tenant', {
      requestedBy: req.user.sub,
      tenantName: req.body.name,
    });

    const tenant = await tenantService.createTenant(req.body, req.user);

    res.status(201).json({
      success: true,
      data: {
        tenant,
      },
      message: 'Tenant created successfully',
    });
  })
);

/**
 * @route GET /api/tenants/:tenantId
 * @desc Get a specific tenant (Master tenant only)
 * @access Private (Master Admin)
 */
router.get('/:tenantId',
  auth.authenticate(),
  AuthorizationMiddleware.requireMasterAdmin(),
  ValidationMiddleware.validateParams(ValidationSchemas.tenantIdParam),
  AuthorizationMiddleware.auditSensitiveOperation('tenant_view'),
  ErrorHandler.asyncHandler(async (req, res) => {
    logger.info('Getting tenant details', {
      requestedBy: req.user.sub,
      tenantId: req.params.tenantId,
    });

    const tenant = await tenantService.getTenant(req.params.tenantId, req.user);

    res.json({
      success: true,
      data: {
        tenant,
      },
      message: 'Tenant retrieved successfully',
    });
  })
);

/**
 * @route PUT /api/tenants/:tenantId
 * @desc Update a tenant (Master tenant only)
 * @access Private (Master Admin)
 */
router.put('/:tenantId',
  auth.authenticate(),
  AuthorizationMiddleware.requireMasterAdmin(),
  ValidationMiddleware.validate({
    params: ValidationSchemas.tenantIdParam,
    body: ValidationSchemas.updateTenant,
  }),
  AuthorizationMiddleware.auditSensitiveOperation('tenant_update'),
  ErrorHandler.asyncHandler(async (req, res) => {
    logger.info('Updating tenant', {
      requestedBy: req.user.sub,
      tenantId: req.params.tenantId,
      updates: Object.keys(req.body),
    });

    const tenant = await tenantService.updateTenant(
      req.params.tenantId,
      req.body,
      req.user
    );

    res.json({
      success: true,
      data: {
        tenant,
      },
      message: 'Tenant updated successfully',
    });
  })
);

/**
 * @route DELETE /api/tenants/:tenantId
 * @desc Delete a tenant (Master tenant only)
 * @access Private (Master Admin)
 */
router.delete('/:tenantId',
  auth.authenticate(),
  AuthorizationMiddleware.requireMasterAdmin(),
  ValidationMiddleware.validateParams(ValidationSchemas.tenantIdParam),
  AuthorizationMiddleware.auditSensitiveOperation('tenant_delete'),
  ErrorHandler.asyncHandler(async (req, res) => {
    logger.info('Deleting tenant', {
      requestedBy: req.user.sub,
      tenantId: req.params.tenantId,
    });

    const result = await tenantService.deleteTenant(req.params.tenantId, req.user);

    res.json({
      success: true,
      data: result,
      message: 'Tenant deleted successfully',
    });
  })
);

/**
 * @route GET /api/tenants/:tenantId/stats
 * @desc Get tenant statistics (Master tenant only)
 * @access Private (Master Admin)
 */
router.get('/:tenantId/stats',
  auth.authenticate(),
  AuthorizationMiddleware.requireMasterAdmin(),
  ValidationMiddleware.validateParams(ValidationSchemas.tenantIdParam),
  ErrorHandler.asyncHandler(async (req, res) => {
    logger.info('Getting tenant statistics', {
      requestedBy: req.user.sub,
      tenantId: req.params.tenantId,
    });

    const stats = await tenantService.getTenantStats(req.params.tenantId);

    res.json({
      success: true,
      data: {
        stats,
      },
      message: 'Tenant statistics retrieved successfully',
    });
  })
);

/**
 * @route GET /api/tenants/:tenantId/users
 * @desc Get users for a specific tenant (Master tenant only)
 * @access Private (Master Admin)
 */
router.get('/:tenantId/users',
  auth.authenticate(),
  AuthorizationMiddleware.requireMasterAdmin(),
  ValidationMiddleware.validate({
    params: ValidationSchemas.tenantIdParam,
    query: ValidationSchemas.userListQuery,
  }),
  AuthorizationMiddleware.auditSensitiveOperation('tenant_users_list'),
  ErrorHandler.asyncHandler(async (req, res) => {
    logger.info('Getting users for tenant', {
      requestedBy: req.user.sub,
      tenantId: req.params.tenantId,
      filters: req.query,
    });

    // Import UserService here to avoid circular dependency
    const UserService = require('../services/userService');
    const userService = new UserService();

    const result = await userService.getUsers(
      req.params.tenantId,
      req.query,
      req.user
    );

    res.json({
      success: true,
      data: result,
      message: `Retrieved ${result.users.length} users for tenant`,
    });
  })
);

/**
 * @route POST /api/tenants/:tenantId/users
 * @desc Create a user in a specific tenant (Master tenant only)
 * @access Private (Master Admin)
 */
router.post('/:tenantId/users',
  auth.authenticate(),
  AuthorizationMiddleware.requireMasterAdmin(),
  ValidationMiddleware.validate({
    params: ValidationSchemas.tenantIdParam,
    body: ValidationSchemas.createUser,
  }),
  AuthorizationMiddleware.auditSensitiveOperation('tenant_user_create'),
  ErrorHandler.asyncHandler(async (req, res) => {
    logger.info('Creating user in tenant', {
      requestedBy: req.user.sub,
      tenantId: req.params.tenantId,
      userEmail: req.body.email,
    });

    // Import UserService here to avoid circular dependency
    const UserService = require('../services/userService');
    const userService = new UserService();

    const user = await userService.createUser(
      req.params.tenantId,
      req.body,
      req.user
    );

    res.status(201).json({
      success: true,
      data: {
        user,
      },
      message: 'User created successfully in tenant',
    });
  })
);

/**
 * @route PUT /api/tenants/:tenantId/seat-limit
 * @desc Update seat limit for a tenant (Master tenant only)
 * @access Private (Master Admin)
 */
router.put('/:tenantId/seat-limit',
  auth.authenticate(),
  AuthorizationMiddleware.requireMasterAdmin(),
  ValidationMiddleware.validate({
    params: ValidationSchemas.tenantIdParam,
    body: ValidationSchemas.updateSeatLimit,
  }),
  AuthorizationMiddleware.auditSensitiveOperation('tenant_seat_limit_update'),
  ErrorHandler.asyncHandler(async (req, res) => {
    logger.info('Updating tenant seat limit', {
      requestedBy: req.user.sub,
      tenantId: req.params.tenantId,
      newSeatLimit: req.body.seatLimit,
    });

    const tenant = await tenantService.updateTenant(
      req.params.tenantId,
      { seatLimit: req.body.seatLimit },
      req.user
    );

    res.json({
      success: true,
      data: {
        tenant,
      },
      message: 'Tenant seat limit updated successfully',
    });
  })
);

/**
 * @route GET /api/tenants/:tenantId/seat-usage
 * @desc Get seat usage for a tenant (Master tenant only)
 * @access Private (Master Admin)
 */
router.get('/:tenantId/seat-usage',
  auth.authenticate(),
  AuthorizationMiddleware.requireMasterAdmin(),
  ValidationMiddleware.validateParams(ValidationSchemas.tenantIdParam),
  ErrorHandler.asyncHandler(async (req, res) => {
    logger.info('Getting tenant seat usage', {
      requestedBy: req.user.sub,
      tenantId: req.params.tenantId,
    });

    // Import SeatService here to avoid circular dependency
    const SeatService = require('../services/seatService');
    const seatService = new SeatService();

    const seatUsage = await seatService.getTenantSeatUsage(req.params.tenantId);
    const seatReport = await seatService.getSeatReport(req.params.tenantId);

    res.json({
      success: true,
      data: {
        seatUsage,
        seatReport,
      },
      message: 'Tenant seat usage retrieved successfully',
    });
  })
);

/**
 * @route POST /api/tenants/:tenantId/validate-access
 * @desc Validate tenant access for a user (Internal use)
 * @access Private (Authenticated)
 */
router.post('/:tenantId/validate-access',
  auth.authenticate(),
  ValidationMiddleware.validateParams(ValidationSchemas.tenantIdParam),
  ErrorHandler.asyncHandler(async (req, res) => {
    logger.info('Validating tenant access', {
      requestedBy: req.user.sub,
      tenantId: req.params.tenantId,
    });

    const validation = await tenantService.validateTenantAccess(
      req.user,
      req.params.tenantId
    );

    res.json({
      success: true,
      data: validation,
      message: 'Tenant access validation completed',
    });
  })
);

module.exports = router;