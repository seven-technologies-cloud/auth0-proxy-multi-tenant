import auth0Service from './auth0.service.js';
import config from '../config/env.js';

/**
 * Roles Service
 * Handles role-related business logic and Auth0 API interactions
 */
class RolesService {
  /**
   * Search roles with pagination and filtering
   * @param {object} params - Search parameters
   * @returns {Promise<object>} - Roles search results
   */
  async searchRoles(params = {}) {
    // Build query parameters for Auth0 API
    const auth0Params = {};
    
    if (params.q) auth0Params.name_filter = params.q;
    if (params.page !== undefined) auth0Params.page = parseInt(params.page);
    if (params.per_page !== undefined) auth0Params.per_page = Math.min(parseInt(params.per_page), 100);
    if (params.include_totals !== undefined) auth0Params.include_totals = params.include_totals === 'true';

    const result = await auth0Service.searchRoles(auth0Params);
    
    return {
      roles: result.roles || result,
      total: result.total,
      start: result.start,
      limit: result.limit,
      length: result.length,
    };
  }

  /**
   * Get a role by ID
   * @param {string} roleId - Role ID
   * @returns {Promise<object>} - Role object
   */
  async getRole(roleId) {
    return await auth0Service.getRole(roleId);
  }

  /**
   * Create a new role with idempotent behavior
   * @param {object} roleData - Role data
   * @returns {Promise<object>} - Created or existing role object
   */
  async createRole(roleData) {
    // Validate required fields
    if (!roleData.name) {
      const error = new Error('Role name is required');
      error.statusCode = 400;
      error.code = 'MISSING_ROLE_NAME';
      throw error;
    }

    // Idempotent create: check if role already exists by name
    const existingRole = await auth0Service.findRoleByName(roleData.name);
    
    if (existingRole) {
      if (config.idempotentCreateMode === 'conflict') {
        const error = new Error('Role with this name already exists');
        error.statusCode = 409;
        error.code = 'ROLE_EXISTS';
        error.details = { existingRoleId: existingRole.id };
        throw error;
      } else {
        // Return existing role with 200 status
        return {
          role: {
            ...existingRole,
            _idempotent: true,
            _message: 'Role already exists, returning existing role',
          },
          statusCode: 200,
        };
      }
    }

    // Prepare role data for Auth0 API
    const auth0RoleData = {
      name: roleData.name,
      description: roleData.description,
    };

    // Create new role
    const newRole = await auth0Service.createRole(auth0RoleData);

    // Handle permissions if provided
    if (roleData.permissions && Array.isArray(roleData.permissions) && roleData.permissions.length > 0) {
      try {
        await auth0Service.assignRolePermissions(newRole.id, roleData.permissions);
        // Fetch the role again to get updated permissions
        const updatedRole = await auth0Service.getRole(newRole.id);
        return { role: updatedRole, statusCode: 201 };
      } catch (permissionError) {
        // Role was created but permissions failed - log warning but don't fail
        console.warn(`Role ${newRole.id} created but permission assignment failed:`, permissionError.message);
        return { 
          role: {
            ...newRole,
            _warning: 'Role created but some permissions could not be assigned',
          }, 
          statusCode: 201,
        };
      }
    }

    return { role: newRole, statusCode: 201 };
  }

  /**
   * Update a role
   * @param {string} roleId - Role ID
   * @param {object} roleData - Role data to update
   * @returns {Promise<object>} - Updated role object
   */
  async updateRole(roleId, roleData) {
    // Validate update data - only allow safe fields
    const allowedFields = ['name', 'description'];
    const updateData = {};
    
    Object.keys(roleData).forEach(key => {
      if (allowedFields.includes(key)) {
        updateData[key] = roleData[key];
      }
    });

    if (Object.keys(updateData).length === 0 && !roleData.permissions) {
      const error = new Error('No valid fields to update');
      error.statusCode = 400;
      error.code = 'NO_VALID_FIELDS';
      error.details = { allowedFields };
      throw error;
    }

    let updatedRole;
    
    // Update basic role fields if any
    if (Object.keys(updateData).length > 0) {
      updatedRole = await auth0Service.updateRole(roleId, updateData);
    } else {
      // Get current role if only updating permissions
      updatedRole = await auth0Service.getRole(roleId);
    }

    // Handle permissions update if provided
    if (roleData.permissions && Array.isArray(roleData.permissions)) {
      try {
        // For simplicity, we replace all permissions (remove all, then add new ones)
        // In production, you might want more granular permission management
        await auth0Service.assignRolePermissions(roleId, roleData.permissions);
        
        // Fetch the role again to get updated permissions
        updatedRole = await auth0Service.getRole(roleId);
      } catch (permissionError) {
        console.warn(`Role ${roleId} updated but permission update failed:`, permissionError.message);
        updatedRole._warning = 'Role updated but some permissions could not be updated';
      }
    }

    return updatedRole;
  }

  /**
   * Delete a role
   * @param {string} roleId - Role ID
   * @returns {Promise<void>}
   */
  async deleteRole(roleId) {
    await auth0Service.deleteRole(roleId);
  }
}

export default new RolesService();