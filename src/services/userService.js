const Auth0Service = require('./auth0Service');
const SeatService = require('./seatService');
const logger = require('../utils/logger');
const {
  UserNotFoundError,
  DuplicateEmailError,
  ValidationError,
  SeatLimitExceededError,
  UnauthorizedTenantAccessError,
  ErrorFactory,
} = require('../utils/errors');

class UserService {
  constructor() {
    this.auth0Service = new Auth0Service();
    this.seatService = new SeatService();
    this.initializeService();
  }

  /**
   * Initialize the user service
   */
  initializeService() {
    logger.info('User service initialized');
  }

  /**
   * Get users for a specific tenant
   */
  async getUsers(tenantId, options = {}, requestedBy) {
    try {
      logger.info('Getting users for tenant:', tenantId);

      const {
        page = 1,
        limit = 10,
        search,
        role,
        status,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = options;

      // In a real implementation, you would determine the tenant domain
      const tenantDomain = `tenant-${tenantId}.auth0.com`;

      // Get users from Auth0
      const auth0Options = {
        page: page - 1, // Auth0 uses 0-based pagination
        per_page: limit,
        search,
        include_totals: true,
      };

      const usersResponse = await this.auth0Service.getUsers(tenantDomain, auth0Options);

      // Filter and transform users
      let users = [];
      let actualUsers = usersResponse.users;
      
      // Handle nested structure from Auth0 API
      if (actualUsers && actualUsers.users && Array.isArray(actualUsers.users)) {
        actualUsers = actualUsers.users;
      }
      
      if (Array.isArray(actualUsers)) {
        users = actualUsers.map(user => this.transformAuth0User(user, tenantId));
      } else {
        logger.warn('Unexpected users response format:', usersResponse);
      }

      // Apply additional filters
      if (role) {
        users = users.filter(user => 
          user.roles && user.roles.includes(role)
        );
      }

      if (status) {
        users = users.filter(user => user.status === status);
      }

      // Sort users
      users.sort((a, b) => {
        const aValue = a[sortBy];
        const bValue = b[sortBy];
        
        if (sortOrder === 'asc') {
          return aValue > bValue ? 1 : -1;
        } else {
          return aValue < bValue ? 1 : -1;
        }
      });

      const result = {
        users,
        pagination: {
          total: usersResponse.total,
          page,
          limit,
          totalPages: Math.ceil(usersResponse.total / limit),
          hasNext: (page * limit) < usersResponse.total,
          hasPrev: page > 1,
        },
      };

      logger.info(`Retrieved ${users.length} users for tenant: ${tenantId}`);
      return result;
    } catch (error) {
      logger.error('Failed to get users:', error);
      if (error.name && error.name.includes('Auth0')) {
        throw ErrorFactory.fromAuth0Error(error);
      }
      throw error;
    }
  }

  /**
   * Create a new user in a specific tenant
   */
  async createUser(tenantId, userData, createdBy) {
    try {
      logger.info('Creating user for tenant:', tenantId);

      // Validate user data
      this.validateUserData(userData);

      // Check seat availability
      const seatAvailability = await this.seatService.checkSeatAvailability(tenantId, 1);
      if (!seatAvailability.available) {
        throw new SeatLimitExceededError(
          tenantId,
          seatAvailability.seatUsed,
          seatAvailability.seatLimit,
          {
            requestedSeats: 1,
            availableSeats: seatAvailability.availableSeats,
          }
        );
      }

      // Prepare user data for Auth0
      const tenantDomain = `tenant-${tenantId}.auth0.com`;
      const auth0UserData = {
        ...userData,
        tenantId,
        metadata: {
          ...userData.metadata,
          createdBy: createdBy.sub || createdBy.id,
          tenantId,
        },
        appMetadata: {
          tenant_id: tenantId,
          roles: userData.roles || ['user'],
          ...userData.appMetadata,
        },
      };

      // Create user in Auth0
      const auth0User = await this.auth0Service.createUser(tenantDomain, auth0UserData);

      // Reserve seat
      await this.seatService.reserveSeats(tenantId, 1);

      // Transform and return user
      const user = this.transformAuth0User(auth0User, tenantId);

      // Log audit event
      logger.audit('user_created', 'user', createdBy, {
        userId: user.id,
        tenantId,
        userEmail: user.email,
      });

      logger.info('User created successfully:', user.id);
      return user;
    } catch (error) {
      logger.error('Failed to create user:', error);
      if (error.name && error.name.includes('Auth0')) {
        throw ErrorFactory.fromAuth0Error(error);
      }
      throw error;
    }
  }

  /**
   * Get a specific user
   */
  async getUser(tenantId, userId, requestedBy) {
    try {
      logger.info('Getting user:', userId);

      // Get user from Auth0
      const auth0User = await this.auth0Service.getUser(userId);

      // Verify user belongs to the tenant (skip for M2M clients with null tenantId)
      const userTenantId = auth0User.app_metadata?.tenant_id;
      if (tenantId !== null && userTenantId !== tenantId) {
        throw new UnauthorizedTenantAccessError(tenantId, {
          userId,
          userTenantId,
        });
      }

      // Get user roles
      const roles = await this.auth0Service.getUserRoles(userId);

      // Transform and return user
      const user = this.transformAuth0User(auth0User, tenantId);
      user.roles = roles.map(role => role.name);

      logger.info('User retrieved successfully:', userId);
      return user;
    } catch (error) {
      logger.error('Failed to get user:', error);
      if (error.name && error.name.includes('Auth0')) {
        throw ErrorFactory.fromAuth0Error(error);
      }
      throw error;
    }
  }

  /**
   * Update user information
   */
  async updateUser(tenantId, userId, updates, updatedBy) {
    try {
      logger.info('Updating user:', userId);

      // Validate updates
      this.validateUserUpdates(updates);

      // Get current user to verify tenant
      const currentUser = await this.getUser(tenantId, userId, updatedBy);

      // Prepare updates for Auth0
      const auth0Updates = {
        ...updates,
        user_metadata: {
          ...currentUser.metadata,
          ...updates.metadata,
          updatedBy: updatedBy.sub || updatedBy.id,
          updatedAt: new Date(),
        },
      };

      // Remove fields that shouldn't be updated directly
      delete auth0Updates.metadata;
      delete auth0Updates.roles;

      // Update user in Auth0
      const updatedAuth0User = await this.auth0Service.updateUser(userId, auth0Updates);

      // Handle role updates separately
      if (updates.roles) {
        await this.updateUserRoles(userId, updates.roles, updatedBy);
      }

      // Transform and return updated user
      const user = this.transformAuth0User(updatedAuth0User, tenantId);

      // Log audit event
      logger.audit('user_updated', 'user', updatedBy, {
        userId,
        tenantId,
        updates: Object.keys(updates),
      });

      logger.info('User updated successfully:', userId);
      return user;
    } catch (error) {
      logger.error('Failed to update user:', error);
      if (error.name && error.name.includes('Auth0')) {
        throw ErrorFactory.fromAuth0Error(error);
      }
      throw error;
    }
  }

  /**
   * Delete a user
   */
  async deleteUser(tenantId, userId, deletedBy) {
    try {
      logger.info('Deleting user:', userId);

      // Get user to verify tenant and get info for audit
      const user = await this.getUser(tenantId, userId, deletedBy);

      // Delete user from Auth0
      await this.auth0Service.deleteUser(userId);

      // Release seat
      await this.seatService.releaseSeats(tenantId, 1);

      // Log audit event
      logger.audit('user_deleted', 'user', deletedBy, {
        userId,
        tenantId,
        userEmail: user.email,
      });

      logger.info('User deleted successfully:', userId);
      return {
        id: userId,
        email: user.email,
        name: user.name,
        deleted: true,
        deletedAt: new Date(),
      };
    } catch (error) {
      logger.error('Failed to delete user:', error);
      if (error.name && error.name.includes('Auth0')) {
        throw ErrorFactory.fromAuth0Error(error);
      }
      throw error;
    }
  }

  /**
   * Get user roles
   */
  async getUserRoles(tenantId, userId, requestedBy) {
    try {
      logger.info('Getting user roles:', userId);

      // Verify user belongs to tenant
      await this.getUser(tenantId, userId, requestedBy);

      // Get roles from Auth0
      const roles = await this.auth0Service.getUserRoles(userId);

      const result = {
        userId,
        roles: roles.map(role => ({
          id: role.id,
          name: role.name,
          description: role.description,
        })),
      };

      logger.info(`Retrieved ${roles.length} roles for user: ${userId}`);
      return result;
    } catch (error) {
      logger.error('Failed to get user roles:', error);
      if (error.name && error.name.includes('Auth0')) {
        throw ErrorFactory.fromAuth0Error(error);
      }
      throw error;
    }
  }

  /**
   * Update user roles
   */
  async updateUserRoles(userId, roleNames, updatedBy) {
    try {
      logger.info('Updating user roles:', userId);

      // In a real implementation, you would:
      // 1. Get available roles for the tenant
      // 2. Map role names to role IDs
      // 3. Get current user roles
      // 4. Calculate roles to add and remove
      // 5. Update roles in Auth0

      // For now, we'll simulate this
      const mockRoleIds = roleNames.map(name => `role_${name}_${Date.now()}`);

      // Remove all current roles and assign new ones
      // This is simplified - in practice you'd be more surgical
      await this.auth0Service.assignRoles(userId, mockRoleIds);

      logger.info(`Updated roles for user ${userId}:`, roleNames);
      return {
        userId,
        roles: roleNames,
        updated: true,
      };
    } catch (error) {
      logger.error('Failed to update user roles:', error);
      if (error.name && error.name.includes('Auth0')) {
        throw ErrorFactory.fromAuth0Error(error);
      }
      throw error;
    }
  }

  /**
   * Validate seat availability before user creation
   */
  async validateSeatAvailability(tenantId, requestedSeats = 1) {
    try {
      logger.info(`Validating seat availability for tenant ${tenantId}`);

      const availability = await this.seatService.checkSeatAvailability(tenantId, requestedSeats);
      
      if (!availability.available) {
        throw new SeatLimitExceededError(
          tenantId,
          availability.seatUsed,
          availability.seatLimit,
          {
            requestedSeats,
            availableSeats: availability.availableSeats,
          }
        );
      }

      return availability;
    } catch (error) {
      logger.error('Failed to validate seat availability:', error);
      throw error;
    }
  }

  /**
   * Transform Auth0 user to our user format
   */
  transformAuth0User(auth0User, tenantId) {
    return {
      id: auth0User.user_id,
      tenantId,
      auth0UserId: auth0User.user_id,
      email: auth0User.email,
      name: auth0User.name || auth0User.nickname,
      picture: auth0User.picture,
      roles: auth0User.app_metadata?.roles || ['user'],
      status: this.getUserStatus(auth0User),
      lastLogin: auth0User.last_login ? new Date(auth0User.last_login) : null,
      loginCount: auth0User.logins_count || 0,
      metadata: auth0User.user_metadata || {},
      appMetadata: auth0User.app_metadata || {},
      emailVerified: auth0User.email_verified || false,
      createdAt: new Date(auth0User.created_at),
      updatedAt: new Date(auth0User.updated_at),
    };
  }

  /**
   * Determine user status from Auth0 user data
   */
  getUserStatus(auth0User) {
    if (auth0User.blocked) return 'blocked';
    if (!auth0User.email_verified) return 'pending';
    return 'active';
  }

  /**
   * Validate user data
   */
  validateUserData(userData) {
    const errors = [];

    if (!userData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userData.email)) {
      errors.push('Valid email address is required');
    }

    if (!userData.name || userData.name.trim().length < 2) {
      errors.push('Name must be at least 2 characters long');
    }

    if (userData.password && userData.password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (userData.roles && !Array.isArray(userData.roles)) {
      errors.push('Roles must be an array');
    }

    if (errors.length > 0) {
      throw new ValidationError('User validation failed', { errors });
    }
  }

  /**
   * Validate user updates
   */
  validateUserUpdates(updates) {
    const errors = [];

    if (updates.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updates.email)) {
      errors.push('Valid email address is required');
    }

    if (updates.name && updates.name.trim().length < 2) {
      errors.push('Name must be at least 2 characters long');
    }

    if (updates.password && updates.password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (updates.roles && !Array.isArray(updates.roles)) {
      errors.push('Roles must be an array');
    }

    if (errors.length > 0) {
      throw new ValidationError('User update validation failed', { errors });
    }
  }

  /**
   * Get user statistics for a tenant
   */
  async getUserStats(tenantId) {
    try {
      logger.info('Getting user statistics for tenant:', tenantId);

      // Get all users for the tenant
      const usersResponse = await this.getUsers(tenantId, { limit: 1000 });
      const users = usersResponse.users;

      const stats = {
        tenantId,
        totalUsers: users.length,
        activeUsers: users.filter(u => u.status === 'active').length,
        blockedUsers: users.filter(u => u.status === 'blocked').length,
        pendingUsers: users.filter(u => u.status === 'pending').length,
        verifiedUsers: users.filter(u => u.emailVerified).length,
        recentLogins: users.filter(u => 
          u.lastLogin && u.lastLogin > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        ).length,
        roleDistribution: this.calculateRoleDistribution(users),
        averageLoginCount: users.reduce((sum, u) => sum + u.loginCount, 0) / users.length || 0,
      };

      return stats;
    } catch (error) {
      logger.error('Failed to get user statistics:', error);
      throw error;
    }
  }

  /**
   * Calculate role distribution
   */
  calculateRoleDistribution(users) {
    const distribution = {};
    
    users.forEach(user => {
      user.roles.forEach(role => {
        distribution[role] = (distribution[role] || 0) + 1;
      });
    });

    return distribution;
  }
}

module.exports = UserService;