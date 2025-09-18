import auth0Service from './auth0.service.js';

/**
 * User Roles Service
 * Handles user-role assignment business logic with idempotent operations
 */
class UserRolesService {
  /**
   * Get roles assigned to a user
   * @param {string} userId - User ID
   * @returns {Promise<Array>} - Array of role objects
   */
  async getUserRoles(userId) {
    return await auth0Service.getUserRoles(userId);
  }

  /**
   * Assign roles to a user (idempotent)
   * @param {string} userId - User ID
   * @param {Array} roleIds - Array of role IDs to assign
   * @returns {Promise<object>} - Assignment result with details
   */
  async assignUserRoles(userId, roleIds) {
    if (!Array.isArray(roleIds) || roleIds.length === 0) {
      const error = new Error('roleIds must be a non-empty array');
      error.statusCode = 400;
      error.code = 'INVALID_ROLE_IDS';
      throw error;
    }

    // Get current user roles to compute set difference
    const currentRoles = await auth0Service.getUserRoles(userId);
    const currentRoleIds = new Set(currentRoles.map(role => role.id));
    
    // Compute roles to assign (set difference: requested - current)
    const rolesToAssign = roleIds.filter(roleId => !currentRoleIds.has(roleId));
    
    if (rolesToAssign.length === 0) {
      // All roles already assigned - idempotent success
      return {
        message: 'All roles already assigned to user',
        assignedRoles: roleIds.length,
        newAssignments: 0,
        alreadyAssigned: roleIds.length,
        roles: currentRoles.filter(role => roleIds.includes(role.id)),
      };
    }

    // Assign only the new roles
    await auth0Service.assignUserRoles(userId, rolesToAssign);
    
    // Get updated roles list
    const updatedRoles = await auth0Service.getUserRoles(userId);
    
    return {
      message: `Successfully assigned ${rolesToAssign.length} new role(s) to user`,
      assignedRoles: roleIds.length,
      newAssignments: rolesToAssign.length,
      alreadyAssigned: roleIds.length - rolesToAssign.length,
      roles: updatedRoles.filter(role => roleIds.includes(role.id)),
    };
  }

  /**
   * Remove roles from a user (idempotent)
   * @param {string} userId - User ID
   * @param {Array} roleIds - Array of role IDs to remove
   * @returns {Promise<object>} - Removal result with details
   */
  async removeUserRoles(userId, roleIds) {
    if (!Array.isArray(roleIds) || roleIds.length === 0) {
      const error = new Error('roleIds must be a non-empty array');
      error.statusCode = 400;
      error.code = 'INVALID_ROLE_IDS';
      throw error;
    }

    // Get current user roles to compute set difference
    const currentRoles = await auth0Service.getUserRoles(userId);
    const currentRoleIds = new Set(currentRoles.map(role => role.id));
    
    // Compute roles to remove (set intersection: requested ∩ current)
    const rolesToRemove = roleIds.filter(roleId => currentRoleIds.has(roleId));
    
    if (rolesToRemove.length === 0) {
      // No roles to remove - idempotent success
      return {
        message: 'No roles to remove (none were assigned)',
        requestedRemovals: roleIds.length,
        actualRemovals: 0,
        notAssigned: roleIds.length,
        remainingRoles: currentRoles,
      };
    }

    // Remove only the roles that are actually assigned
    await auth0Service.removeUserRoles(userId, rolesToRemove);
    
    // Get updated roles list
    const updatedRoles = await auth0Service.getUserRoles(userId);
    
    return {
      message: `Successfully removed ${rolesToRemove.length} role(s) from user`,
      requestedRemovals: roleIds.length,
      actualRemovals: rolesToRemove.length,
      notAssigned: roleIds.length - rolesToRemove.length,
      remainingRoles: updatedRoles,
    };
  }
}

export default new UserRolesService();