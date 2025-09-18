import rolesService from '../services/roles.service.js';

/**
 * Roles Controller
 * Handles all role-related operations via Auth0 Management API
 */
class RolesController {
  /**
   * Get roles with search and pagination
   * GET /roles?q=&page=&per_page=&include_totals=
   */
  async getRoles(req, res) {
    const {
      q,
      page,
      per_page,
      include_totals,
    } = req.query;

    // Build query parameters
    const params = {};
    
    if (q) params.q = q;
    if (page) params.page = parseInt(page);
    if (per_page) params.per_page = Math.min(parseInt(per_page), 100); // Limit to 100
    if (include_totals) params.include_totals = include_totals === 'true';

    try {
      const result = await rolesService.searchRoles(params);
      res.json(result);
    } catch (error) {
      throw error; // Let error middleware handle it
    }
  }

  /**
   * Get a specific role by ID
   * GET /roles/:id
   */
  async getRole(req, res) {
    const { id } = req.params;

    if (!id) {
      const error = new Error('Role ID is required');
      error.statusCode = 400;
      error.code = 'MISSING_ROLE_ID';
      throw error;
    }

    try {
      const role = await rolesService.getRole(id);
      res.json(role);
    } catch (error) {
      if (error.statusCode === 404) {
        error.message = 'Role not found';
        error.code = 'ROLE_NOT_FOUND';
      }
      throw error;
    }
  }

  /**
   * Create a new role with idempotent behavior
   * POST /roles
   */
  async createRole(req, res) {
    const roleData = req.body;

    // Validate required fields
    if (!roleData.name) {
      const error = new Error('Role name is required');
      error.statusCode = 400;
      error.code = 'MISSING_ROLE_NAME';
      throw error;
    }

    // Validate permissions format if provided
    if (roleData.permissions) {
      if (!Array.isArray(roleData.permissions)) {
        const error = new Error('Permissions must be an array');
        error.statusCode = 400;
        error.code = 'INVALID_PERMISSIONS_FORMAT';
        throw error;
      }

      // Validate each permission object
      for (const permission of roleData.permissions) {
        if (!permission.permission_name || !permission.resource_server_identifier) {
          const error = new Error('Each permission must have permission_name and resource_server_identifier');
          error.statusCode = 400;
          error.code = 'INVALID_PERMISSION_OBJECT';
          throw error;
        }
      }
    }

    try {
      const result = await rolesService.createRole(roleData);
      res.status(result.statusCode).json(result.role);
    } catch (error) {
      // Handle Auth0 specific errors
      if (error.code === 'role_exists' || error.statusCode === 409) {
        error.message = 'Role with this name already exists';
        error.code = 'ROLE_EXISTS';
      }
      throw error;
    }
  }

  /**
   * Update a role
   * PATCH /roles/:id
   */
  async updateRole(req, res) {
    const { id } = req.params;
    const roleData = req.body;

    if (!id) {
      const error = new Error('Role ID is required');
      error.statusCode = 400;
      error.code = 'MISSING_ROLE_ID';
      throw error;
    }

    // Validate permissions format if provided
    if (roleData.permissions) {
      if (!Array.isArray(roleData.permissions)) {
        const error = new Error('Permissions must be an array');
        error.statusCode = 400;
        error.code = 'INVALID_PERMISSIONS_FORMAT';
        throw error;
      }

      // Validate each permission object
      for (const permission of roleData.permissions) {
        if (!permission.permission_name || !permission.resource_server_identifier) {
          const error = new Error('Each permission must have permission_name and resource_server_identifier');
          error.statusCode = 400;
          error.code = 'INVALID_PERMISSION_OBJECT';
          throw error;
        }
      }
    }

    try {
      const updatedRole = await rolesService.updateRole(id, roleData);
      res.json(updatedRole);
    } catch (error) {
      if (error.statusCode === 404) {
        error.message = 'Role not found';
        error.code = 'ROLE_NOT_FOUND';
      }
      throw error;
    }
  }

  /**
   * Delete a role
   * DELETE /roles/:id
   */
  async deleteRole(req, res) {
    const { id } = req.params;

    if (!id) {
      const error = new Error('Role ID is required');
      error.statusCode = 400;
      error.code = 'MISSING_ROLE_ID';
      throw error;
    }

    try {
      await rolesService.deleteRole(id);
      res.status(204).send();
    } catch (error) {
      if (error.statusCode === 404) {
        error.message = 'Role not found';
        error.code = 'ROLE_NOT_FOUND';
      }
      throw error;
    }
  }
}

export default new RolesController();