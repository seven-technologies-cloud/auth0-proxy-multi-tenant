import auth0Service from '../services/auth0.service.js';
import config from '../config/env.js';

/**
 * Users Controller
 * Handles all user-related operations via Auth0 Management API
 */
class UsersController {
  /**
   * Get users with search and pagination
   * GET /users?search=&q=&page=&per_page=&include_totals=
   */
  async getUsers(req, res) {
    const {
      search,
      q,
      page,
      per_page,
      include_totals,
      sort,
      connection,
      fields,
      include_fields,
    } = req.query;

    // Build query parameters for Auth0 API
    const params = {};
    
    if (search) params.search_engine = 'v3';
    if (q) params.q = q;
    if (search && !q) params.q = `*${search}*`; // Simple search fallback
    if (page) params.page = parseInt(page);
    if (per_page) params.per_page = Math.min(parseInt(per_page), 100); // Limit to 100
    if (include_totals) params.include_totals = include_totals === 'true';
    if (sort) params.sort = sort;
    if (connection) params.connection = connection;
    if (fields) params.fields = fields;
    if (include_fields) params.include_fields = include_fields === 'true';

    try {
      const result = await auth0Service.searchUsers(params);
      
      res.json({
        users: result.users || result,
        total: result.total,
        start: result.start,
        limit: result.limit,
        length: result.length,
      });
    } catch (error) {
      throw error; // Let error middleware handle it
    }
  }

  /**
   * Get a specific user by ID
   * GET /users/:id
   */
  async getUser(req, res) {
    const { id } = req.params;

    if (!id) {
      const error = new Error('User ID is required');
      error.statusCode = 400;
      error.code = 'MISSING_USER_ID';
      throw error;
    }

    try {
      const user = await auth0Service.getUser(id);
      res.json(user);
    } catch (error) {
      if (error.statusCode === 404) {
        error.message = 'User not found';
        error.code = 'USER_NOT_FOUND';
      }
      throw error;
    }
  }

  /**
   * Create a new user with idempotent behavior
   * POST /users
   */
  async createUser(req, res) {
    const userData = req.body;

    // Validate required fields
    if (!userData.email) {
      const error = new Error('Email is required');
      error.statusCode = 400;
      error.code = 'MISSING_EMAIL';
      throw error;
    }

    if (!userData.connection) {
      const error = new Error('Connection is required');
      error.statusCode = 400;
      error.code = 'MISSING_CONNECTION';
      throw error;
    }

    try {
      // Idempotent create: check if user already exists by email
      const existingUser = await auth0Service.findUserByEmail(userData.email);
      
      if (existingUser) {
        if (config.idempotentCreateMode === 'conflict') {
          const error = new Error('User with this email already exists');
          error.statusCode = 409;
          error.code = 'USER_EXISTS';
          error.details = { existingUserId: existingUser.user_id };
          throw error;
        } else {
          // Return existing user with 200 status
          return res.status(200).json({
            ...existingUser,
            _idempotent: true,
            _message: 'User already exists, returning existing user',
          });
        }
      }

      // Create new user
      const newUser = await auth0Service.createUser(userData);
      res.status(201).json(newUser);
    } catch (error) {
      // Handle Auth0 specific errors
      if (error.code === 'user_exists' || error.statusCode === 409) {
        error.message = 'User with this email already exists';
        error.code = 'USER_EXISTS';
      }
      throw error;
    }
  }

  /**
   * Update a user
   * PATCH /users/:id
   */
  async updateUser(req, res) {
    const { id } = req.params;
    const userData = req.body;

    if (!id) {
      const error = new Error('User ID is required');
      error.statusCode = 400;
      error.code = 'MISSING_USER_ID';
      throw error;
    }

    // Validate update data - only allow safe fields
    const allowedFields = [
      'email',
      'email_verified',
      'phone_number',
      'phone_verified',
      'given_name',
      'family_name',
      'name',
      'nickname',
      'picture',
      'user_metadata',
      'app_metadata', // Be careful with this in production
      'blocked',
      'verify_email',
    ];

    const updateData = {};
    Object.keys(userData).forEach(key => {
      if (allowedFields.includes(key)) {
        updateData[key] = userData[key];
      }
    });

    if (Object.keys(updateData).length === 0) {
      const error = new Error('No valid fields to update');
      error.statusCode = 400;
      error.code = 'NO_VALID_FIELDS';
      error.details = { allowedFields };
      throw error;
    }

    try {
      const updatedUser = await auth0Service.updateUser(id, updateData);
      res.json(updatedUser);
    } catch (error) {
      if (error.statusCode === 404) {
        error.message = 'User not found';
        error.code = 'USER_NOT_FOUND';
      }
      throw error;
    }
  }

  /**
   * Delete a user
   * DELETE /users/:id
   */
  async deleteUser(req, res) {
    const { id } = req.params;

    if (!id) {
      const error = new Error('User ID is required');
      error.statusCode = 400;
      error.code = 'MISSING_USER_ID';
      throw error;
    }

    try {
      await auth0Service.deleteUser(id);
      res.status(204).send();
    } catch (error) {
      if (error.statusCode === 404) {
        error.message = 'User not found';
        error.code = 'USER_NOT_FOUND';
      }
      throw error;
    }
  }
}

export default new UsersController();