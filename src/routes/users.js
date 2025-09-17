const express = require('express');
const UserService = require('../services/userService');
const auth = require('../middleware/auth');
const AuthorizationMiddleware = require('../middleware/authorization');
const { ValidationMiddleware, ValidationSchemas } = require('../middleware/validation');
const ErrorHandler = require('../middleware/errorHandler');
const logger = require('../utils/logger');

const router = express.Router();
const userService = new UserService();

/**
 * @route GET /api/users
 * @desc Get users for the authenticated user's tenant
 * @access Private (Tenant Admin or Master Admin)
 */
router.get('/',
  auth.authenticate(),
  AuthorizationMiddleware.requireUserManagement(),
  ValidationMiddleware.validateQuery(ValidationSchemas.userListQuery),
  ErrorHandler.asyncHandler(async (req, res) => {
    logger.info('Getting users for tenant', {
      requestedBy: req.user.sub,
      tenantId: req.query.tenantId,
      filters: req.query,
    });

    // For M2M API, tenant ID must be provided in query parameters
    const tenantId = req.query.tenantId;
    if (!tenantId) {
      return ErrorHandler.sendError(
        res,
        'VALIDATION_ERROR',
        'Tenant ID is required in query parameters',
        400
      );
    }

    const result = await userService.getUsers(tenantId, req.query, req.user);

    res.json({
      success: true,
      data: result,
      message: `Retrieved ${result.users.length} users`,
    });
  })
);

/**
 * @route POST /api/users
 * @desc Create a new user in the authenticated user's tenant
 * @access Private (Tenant Admin or Master Admin)
 */
router.post('/',
  auth.authenticate(),
  AuthorizationMiddleware.requireUserManagement(),
  ValidationMiddleware.validateBody(ValidationSchemas.createUser),
  AuthorizationMiddleware.auditSensitiveOperation('user_create'),
  ErrorHandler.asyncHandler(async (req, res) => {
    logger.info('Creating new user', {
      requestedBy: req.user.sub,
      tenantId: req.body.tenantId,
      userEmail: req.body.email,
    });

    // For M2M API, tenant ID must be provided in request body
    const tenantId = req.body.tenantId;
    if (!tenantId) {
      return ErrorHandler.sendError(
        res,
        'VALIDATION_ERROR',
        'Tenant ID is required in request body',
        400
      );
    }

    const user = await userService.createUser(tenantId, req.body, req.user);

    res.status(201).json({
      success: true,
      data: {
        user,
      },
      message: 'User created successfully',
    });
  })
);

/**
 * @route GET /api/users/:userId
 * @desc Get a specific user
 * @access Private (Self, Tenant Admin, or Master Admin)
 */
router.get('/:userId',
  auth.authenticate(),
  AuthorizationMiddleware.requireSelfOrManagement('userId'),
  ValidationMiddleware.validateParams(ValidationSchemas.userIdParam),
  ErrorHandler.asyncHandler(async (req, res) => {
    logger.info('Getting user details', {
      requestedBy: req.user.sub,
      userId: req.params.userId,
      tenantId: req.query.tenantId,
    });

    // For M2M API, tenant ID must be provided in query parameters
    const tenantId = req.query.tenantId;
    if (!tenantId) {
      return ErrorHandler.sendError(
        res,
        'VALIDATION_ERROR',
        'Tenant ID is required in query parameters',
        400
      );
    }

    const user = await userService.getUser(tenantId, req.params.userId, req.user);

    res.json({
      success: true,
      data: {
        user,
      },
      message: 'User retrieved successfully',
    });
  })
);

/**
 * @route PUT /api/users/:userId
 * @desc Update a user
 * @access Private (Self for basic info, Tenant Admin or Master Admin for all)
 */
router.put('/:userId',
  auth.authenticate(),
  AuthorizationMiddleware.requireSelfOrManagement('userId'),
  ValidationMiddleware.validate({
    params: ValidationSchemas.userIdParam,
    body: ValidationSchemas.updateUser,
  }),
  AuthorizationMiddleware.auditSensitiveOperation('user_update'),
  ErrorHandler.asyncHandler(async (req, res) => {
    logger.info('Updating user', {
      requestedBy: req.user.sub,
      userId: req.params.userId,
      tenantId: req.body.tenantId,
      updates: Object.keys(req.body),
    });

    // For M2M API, tenant ID must be provided in request body
    const tenantId = req.body.tenantId;
    if (!tenantId) {
      return ErrorHandler.sendError(
        res,
        'VALIDATION_ERROR',
        'Tenant ID is required in request body',
        400
      );
    }

    // Restrict what regular users can update about themselves
    if (req.params.userId === req.user.sub && !(req.user.isMasterClient || req.user.isM2M)) {
      const allowedSelfUpdates = ['name', 'metadata'];
      const updates = Object.keys(req.body);
      const restrictedUpdates = updates.filter(key => !allowedSelfUpdates.includes(key));
      
      if (restrictedUpdates.length > 0) {
        return ErrorHandler.sendError(
          res,
          'INSUFFICIENT_PERMISSIONS',
          `Users can only update their own: ${allowedSelfUpdates.join(', ')}`,
          403,
          { restrictedFields: restrictedUpdates }
        );
      }
    }

    const user = await userService.updateUser(
      tenantId,
      req.params.userId,
      req.body,
      req.user
    );

    res.json({
      success: true,
      data: {
        user,
      },
      message: 'User updated successfully',
    });
  })
);

/**
 * @route DELETE /api/users/:userId
 * @desc Delete a user
 * @access Private (Tenant Admin or Master Admin)
 */
router.delete('/:userId',
  auth.authenticate(),
  AuthorizationMiddleware.requireUserManagement(),
  ValidationMiddleware.validateParams(ValidationSchemas.userIdParam),
  AuthorizationMiddleware.auditSensitiveOperation('user_delete'),
  ErrorHandler.asyncHandler(async (req, res) => {
    logger.info('Deleting user', {
      requestedBy: req.user.sub,
      userId: req.params.userId,
      tenantId: req.query.tenantId,
    });

    // For M2M API, tenant ID must be provided in query parameters
    const tenantId = req.query.tenantId;
    if (!tenantId) {
      return ErrorHandler.sendError(
        res,
        'VALIDATION_ERROR',
        'Tenant ID is required in query parameters',
        400
      );
    }

    const result = await userService.deleteUser(tenantId, req.params.userId, req.user);

    res.json({
      success: true,
      data: result,
      message: 'User deleted successfully',
    });
  })
);

/**
 * @route GET /api/users/:userId/roles
 * @desc Get user roles
 * @access Private (Self, Tenant Admin, or Master Admin)
 */
router.get('/:userId/roles',
  auth.authenticate(),
  AuthorizationMiddleware.requireSelfOrManagement('userId'),
  ValidationMiddleware.validateParams(ValidationSchemas.userIdParam),
  ErrorHandler.asyncHandler(async (req, res) => {
    logger.info('Getting user roles', {
      requestedBy: req.user.sub,
      userId: req.params.userId,
      tenantId: req.query.tenantId,
    });

    // For M2M API, tenant ID must be provided in query parameters
    const tenantId = req.query.tenantId;
    if (!tenantId) {
      return ErrorHandler.sendError(
        res,
        'VALIDATION_ERROR',
        'Tenant ID is required in query parameters',
        400
      );
    }

    const result = await userService.getUserRoles(tenantId, req.params.userId, req.user);

    res.json({
      success: true,
      data: result,
      message: 'User roles retrieved successfully',
    });
  })
);

/**
 * @route PUT /api/users/:userId/roles
 * @desc Update user roles
 * @access Private (Tenant Admin or Master Admin)
 */
router.put('/:userId/roles',
  auth.authenticate(),
  AuthorizationMiddleware.requireUserManagement(),
  ValidationMiddleware.validate({
    params: ValidationSchemas.userIdParam,
    body: ValidationSchemas.updateUserRoles,
  }),
  AuthorizationMiddleware.auditSensitiveOperation('user_roles_update'),
  ErrorHandler.asyncHandler(async (req, res) => {
    logger.info('Updating user roles', {
      requestedBy: req.user.sub,
      userId: req.params.userId,
      tenantId: req.body.tenantId,
      newRoles: req.body.roles,
    });

    // For M2M API, tenant ID must be provided in request body
    const tenantId = req.body.tenantId;
    if (!tenantId) {
      return ErrorHandler.sendError(
        res,
        'VALIDATION_ERROR',
        'Tenant ID is required in request body',
        400
      );
    }

    const result = await userService.updateUserRoles(
      tenantId,
      req.params.userId,
      req.body.roles,
      req.user
    );

    res.json({
      success: true,
      data: result,
      message: 'User roles updated successfully',
    });
  })
);

/**
 * @route GET /api/users/me
 * @desc Get current user's profile
 * @access Private (Authenticated)
 */
router.get('/me',
  auth.authenticate(),
  ErrorHandler.asyncHandler(async (req, res) => {
    logger.info('Getting current user profile', {
      userId: req.user.sub,
    });

    const user = await userService.getUser(req.user.tenant_id, req.user.sub, req.user);

    res.json({
      success: true,
      data: {
        user,
      },
      message: 'User profile retrieved successfully',
    });
  })
);

/**
 * @route PUT /api/users/me
 * @desc Update current user's profile
 * @access Private (Authenticated)
 */
router.put('/me',
  auth.authenticate(),
  ValidationMiddleware.validateBody(ValidationSchemas.updateUser),
  ErrorHandler.asyncHandler(async (req, res) => {
    logger.info('Updating current user profile', {
      userId: req.user.sub,
      updates: Object.keys(req.body),
    });

    // Restrict what users can update about themselves
    const allowedSelfUpdates = ['name', 'metadata'];
    const updates = Object.keys(req.body);
    const restrictedUpdates = updates.filter(key => !allowedSelfUpdates.includes(key));
    
    if (restrictedUpdates.length > 0) {
      return ErrorHandler.sendError(
        res,
        'INSUFFICIENT_PERMISSIONS',
        `You can only update: ${allowedSelfUpdates.join(', ')}`,
        403,
        { restrictedFields: restrictedUpdates }
      );
    }

    const user = await userService.updateUser(
      req.user.tenant_id,
      req.user.sub,
      req.body,
      req.user
    );

    res.json({
      success: true,
      data: {
        user,
      },
      message: 'Profile updated successfully',
    });
  })
);

/**
 * @route GET /api/users/stats
 * @desc Get user statistics for the tenant
 * @access Private (Tenant Admin or Master Admin)
 */
router.get('/stats',
  auth.authenticate(),
  AuthorizationMiddleware.requireUserManagement(),
  ErrorHandler.asyncHandler(async (req, res) => {
    logger.info('Getting user statistics', {
      requestedBy: req.user.sub,
      tenantId: req.query.tenantId,
    });

    // For M2M API, tenant ID must be provided in query parameters
    const tenantId = req.query.tenantId;
    if (!tenantId) {
      return ErrorHandler.sendError(
        res,
        'VALIDATION_ERROR',
        'Tenant ID is required in query parameters',
        400
      );
    }

    const stats = await userService.getUserStats(tenantId);

    res.json({
      success: true,
      data: {
        stats,
      },
      message: 'User statistics retrieved successfully',
    });
  })
);

/**
 * @route POST /api/users/:userId/block
 * @desc Block a user
 * @access Private (Tenant Admin or Master Admin)
 */
router.post('/:userId/block',
  auth.authenticate(),
  AuthorizationMiddleware.requireUserManagement(),
  ValidationMiddleware.validateParams(ValidationSchemas.userIdParam),
  AuthorizationMiddleware.auditSensitiveOperation('user_block'),
  ErrorHandler.asyncHandler(async (req, res) => {
    logger.info('Blocking user', {
      requestedBy: req.user.sub,
      userId: req.params.userId,
      tenantId: req.body.tenantId,
    });

    // For M2M API, tenant ID must be provided in request body
    const tenantId = req.body.tenantId;
    if (!tenantId) {
      return ErrorHandler.sendError(
        res,
        'VALIDATION_ERROR',
        'Tenant ID is required in request body',
        400
      );
    }

    const user = await userService.updateUser(
      tenantId,
      req.params.userId,
      { blocked: true },
      req.user
    );

    res.json({
      success: true,
      data: {
        user,
      },
      message: 'User blocked successfully',
    });
  })
);

/**
 * @route POST /api/users/:userId/unblock
 * @desc Unblock a user
 * @access Private (Tenant Admin or Master Admin)
 */
router.post('/:userId/unblock',
  auth.authenticate(),
  AuthorizationMiddleware.requireUserManagement(),
  ValidationMiddleware.validateParams(ValidationSchemas.userIdParam),
  AuthorizationMiddleware.auditSensitiveOperation('user_unblock'),
  ErrorHandler.asyncHandler(async (req, res) => {
    logger.info('Unblocking user', {
      requestedBy: req.user.sub,
      userId: req.params.userId,
      tenantId: req.body.tenantId,
    });

    // For M2M API, tenant ID must be provided in request body
    const tenantId = req.body.tenantId;
    if (!tenantId) {
      return ErrorHandler.sendError(
        res,
        'VALIDATION_ERROR',
        'Tenant ID is required in request body',
        400
      );
    }

    const user = await userService.updateUser(
      tenantId,
      req.params.userId,
      { blocked: false },
      req.user
    );

    res.json({
      success: true,
      data: {
        user,
      },
      message: 'User unblocked successfully',
    });
  })
);

module.exports = router;