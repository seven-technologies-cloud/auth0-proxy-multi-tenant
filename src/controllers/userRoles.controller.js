import userRolesService from '../services/userRoles.service.js';

/**
 * User Roles Controller
 * Handles user-role assignment operations with idempotent behavior
 */
class UserRolesController {
  /**
   * Get roles assigned to a user
   * GET /users/:id/roles
   */
  async getUserRoles(req, res) {
    const { id } = req.params;

    if (!id) {
      const error = new Error('User ID is required');
      error.statusCode = 400;
      error.code = 'MISSING_USER_ID';
      throw error;
    }

    try {
      const roles = await userRolesService.getUserRoles(id);
      res.json({ roles });
    } catch (error) {
      if (error.statusCode === 404) {
        error.message = 'User not found';
        error.code = 'USER_NOT_FOUND';
      }
      throw error;
    }
  }

  /**
   * Assign roles to a user (idempotent)
   * POST /users/:id/roles
   * Body: { roleIds: [...] }
   */
  async assignUserRoles(req, res) {
    const { id } = req.params;
    const { roleIds } = req.body;

    if (!id) {
      const error = new Error('User ID is required');
      error.statusCode = 400;
      error.code = 'MISSING_USER_ID';
      throw error;
    }

    if (!roleIds || !Array.isArray(roleIds) || roleIds.length === 0) {
      const error = new Error('roleIds must be a non-empty array');
      error.statusCode = 400;
      error.code = 'INVALID_ROLE_IDS';
      throw error;
    }

    // Validate roleIds format
    for (const roleId of roleIds) {
      if (typeof roleId !== 'string' || !roleId.trim()) {
        const error = new Error('All roleIds must be non-empty strings');
        error.statusCode = 400;
        error.code = 'INVALID_ROLE_ID_FORMAT';
        throw error;
      }
    }

    try {
      const result = await userRolesService.assignUserRoles(id, roleIds);
      res.json(result);
    } catch (error) {
      if (error.statusCode === 404) {
        // Could be user not found or role not found
        if (error.message.includes('user')) {
          error.message = 'User not found';
          error.code = 'USER_NOT_FOUND';
        } else {
          error.message = 'One or more roles not found';
          error.code = 'ROLE_NOT_FOUND';
        }
      }
      throw error;
    }
  }

  /**
   * Remove roles from a user (idempotent)
   * DELETE /users/:id/roles
   * Body: { roleIds: [...] }
   */
  async removeUserRoles(req, res) {
    const { id } = req.params;
    const { roleIds } = req.body;

    if (!id) {
      const error = new Error('User ID is required');
      error.statusCode = 400;
      error.code = 'MISSING_USER_ID';
      throw error;
    }

    if (!roleIds || !Array.isArray(roleIds) || roleIds.length === 0) {
      const error = new Error('roleIds must be a non-empty array');
      error.statusCode = 400;
      error.code = 'INVALID_ROLE_IDS';
      throw error;
    }

    // Validate roleIds format
    for (const roleId of roleIds) {
      if (typeof roleId !== 'string' || !roleId.trim()) {
        const error = new Error('All roleIds must be non-empty strings');
        error.statusCode = 400;
        error.code = 'INVALID_ROLE_ID_FORMAT';
        throw error;
      }
    }

    try {
      const result = await userRolesService.removeUserRoles(id, roleIds);
      res.json(result);
    } catch (error) {
      if (error.statusCode === 404) {
        error.message = 'User not found';
        error.code = 'USER_NOT_FOUND';
      }
      throw error;
    }
  }
}

export default new UserRolesController();