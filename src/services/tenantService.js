const Auth0Service = require('./auth0Service');
const SeatService = require('./seatService');
const logger = require('../utils/logger');
const {
  TenantNotFoundError,
  TenantAlreadyExistsError,
  ValidationError,
  BusinessLogicError,
  ErrorFactory,
} = require('../utils/errors');

class TenantService {
  constructor() {
    this.auth0Service = new Auth0Service();
    this.seatService = new SeatService();
    // In a real implementation, this would connect to a database
    this.tenants = new Map();
    this.initializeService();
  }

  /**
   * Initialize the tenant service
   */
  initializeService() {
    logger.info('Tenant service initialized');

    // Only load test fixtures in test environment
    if (process.env.NODE_ENV === 'test') {
      try {
        const { createdTenants } = require('../../tests/fixtures/tenants');
        const seed = [createdTenants.acmeCorp, createdTenants.betaSolutions, createdTenants.suspendedTenant];
        seed.forEach((t) => this.tenants.set(t.id, t));
        logger.info('Test fixtures loaded for testing environment');
      } catch (e) {
        logger.warn('Could not load test fixtures:', e.message);
      }
    } else {
      logger.info('Production mode: No test fixtures loaded');
    }
  }

  /**
   * Create a new tenant
   */
  async createTenant(tenantData, createdBy) {
    try {
      logger.info('Creating new tenant:', tenantData.name);

      // Validate tenant data
      this.validateTenantData(tenantData);

      // Check if tenant with this domain already exists
      const existingTenant = await this.findTenantByDomain(tenantData.domain);
      if (existingTenant) {
        throw new TenantAlreadyExistsError(tenantData.domain, {
          existingTenantId: existingTenant.id,
        });
      }

      // Create tenant in Auth0 (this creates a client application)
      const auth0TenantInfo = await this.auth0Service.createTenant(tenantData);

      // Create tenant record
      const tenant = {
        id: auth0TenantInfo.id,
        name: tenantData.name,
        domain: tenantData.domain,
        auth0ClientId: auth0TenantInfo.auth0ClientId,
        auth0ClientSecret: auth0TenantInfo.auth0ClientSecret,
        seatLimit: tenantData.seatLimit || 10,
        seatUsed: 0,
        status: 'active',
        metadata: {
          ...tenantData.metadata,
          createdBy: createdBy.sub || createdBy.id,
          plan: tenantData.plan || 'standard',
          industry: tenantData.industry,
          contactEmail: tenantData.contactEmail,
        },
        settings: {
          allowUserRegistration: tenantData.allowUserRegistration !== false,
          requireEmailVerification: tenantData.requireEmailVerification !== false,
          enableMFA: tenantData.enableMFA === true,
          sessionTimeout: tenantData.sessionTimeout || 24, // hours
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Store tenant
      this.tenants.set(tenant.id, tenant);

      // Initialize seat management for the tenant
      await this.seatService.initializeTenantSeats(tenant.id, tenant.seatLimit);

      // Log audit event
      logger.audit('tenant_created', 'tenant', createdBy, {
        tenantId: tenant.id,
        tenantName: tenant.name,
        seatLimit: tenant.seatLimit,
      });

      logger.info('Tenant created successfully:', tenant.id);
      return tenant;
    } catch (error) {
      logger.error('Failed to create tenant:', error);
      if (error.name && error.name.includes('Auth0')) {
        throw ErrorFactory.fromAuth0Error(error);
      }
      throw error;
    }
  }

  /**
   * Get all tenants with optional filtering
   */
  async getTenants(filters = {}, requestedBy) {
    try {
      logger.info('Getting tenants with filters:', filters);

      const {
        page = 1,
        limit = 10,
        search,
        status,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = filters;

      let tenantList = Array.from(this.tenants.values());

      // Apply filters
      if (search) {
        const searchLower = search.toLowerCase();
        tenantList = tenantList.filter(tenant =>
          tenant.name.toLowerCase().includes(searchLower) ||
          tenant.domain.toLowerCase().includes(searchLower)
        );
      }

      if (status) {
        tenantList = tenantList.filter(tenant => tenant.status === status);
      }

      // Sort tenants
      tenantList.sort((a, b) => {
        const aValue = a[sortBy];
        const bValue = b[sortBy];
        
        if (sortOrder === 'asc') {
          return aValue > bValue ? 1 : -1;
        } else {
          return aValue < bValue ? 1 : -1;
        }
      });

      // Paginate
      const total = tenantList.length;
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedTenants = tenantList.slice(startIndex, endIndex);

      // Get seat usage for each tenant
      const tenantsWithStats = await Promise.all(
        paginatedTenants.map(async (tenant) => {
          const seatUsage = await this.seatService.getTenantSeatUsage(tenant.id);
          return {
            ...tenant,
            seatUsage,
          };
        })
      );

      const result = {
        tenants: tenantsWithStats,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
          hasNext: endIndex < total,
          hasPrev: page > 1,
        },
      };

      logger.info(`Retrieved ${tenantsWithStats.length} tenants`);
      return result;
    } catch (error) {
      logger.error('Failed to get tenants:', error);
      throw error;
    }
  }

  /**
   * Get a specific tenant by ID
   */
  async getTenant(tenantId, requestedBy) {
    try {
      logger.info('Getting tenant:', tenantId);

      const tenant = this.tenants.get(tenantId);
      if (!tenant) {
        throw new TenantNotFoundError(tenantId);
      }

      // Get detailed seat usage and statistics
      const seatUsage = await this.seatService.getTenantSeatUsage(tenantId);
      const seatReport = await this.seatService.getSeatReport(tenantId);

      const tenantWithStats = {
        ...tenant,
        seatUsage,
        seatReport,
        stats: {
          totalUsers: tenant.seatUsed, // In real implementation, query actual user count
          activeUsers: Math.floor(tenant.seatUsed * 0.8), // Mock data
          lastUserCreated: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
        },
      };

      logger.info('Tenant retrieved successfully:', tenantId);
      return tenantWithStats;
    } catch (error) {
      logger.error('Failed to get tenant:', error);
      throw error;
    }
  }

  /**
   * Update tenant information
   */
  async updateTenant(tenantId, updates, updatedBy) {
    try {
      logger.info('Updating tenant:', tenantId);

      const tenant = this.tenants.get(tenantId);
      if (!tenant) {
        throw new TenantNotFoundError(tenantId);
      }

      // Validate updates
      this.validateTenantUpdates(updates);

      // Handle seat limit changes
      if (updates.seatLimit && updates.seatLimit !== tenant.seatLimit) {
        await this.seatService.updateSeatLimit(tenantId, updates.seatLimit);
      }

      // Update tenant record
      const updatedTenant = {
        ...tenant,
        ...updates,
        metadata: {
          ...tenant.metadata,
          ...updates.metadata,
          updatedBy: updatedBy.sub || updatedBy.id,
        },
        updatedAt: new Date(),
      };

      // Don't allow updating certain fields
      delete updatedTenant.id;
      delete updatedTenant.auth0ClientId;
      delete updatedTenant.auth0ClientSecret;
      delete updatedTenant.createdAt;

      this.tenants.set(tenantId, updatedTenant);

      // Log audit event
      logger.audit('tenant_updated', 'tenant', updatedBy, {
        tenantId,
        updates: Object.keys(updates),
      });

      logger.info('Tenant updated successfully:', tenantId);
      return updatedTenant;
    } catch (error) {
      logger.error('Failed to update tenant:', error);
      throw error;
    }
  }

  /**
   * Delete a tenant
   */
  async deleteTenant(tenantId, deletedBy) {
    try {
      logger.info('Deleting tenant:', tenantId);

      const tenant = this.tenants.get(tenantId);
      if (!tenant) {
        throw new TenantNotFoundError(tenantId);
      }

      // Check if tenant has active users
      if (tenant.seatUsed > 0) {
        throw new BusinessLogicError(
          `Cannot delete tenant with active users. Current users: ${tenant.seatUsed}`,
          {
            tenantId,
            activeUsers: tenant.seatUsed,
          }
        );
      }

      // Delete from Auth0
      await this.auth0Service.deleteTenant(tenantId);

      // Remove seat management
      await this.seatService.removeTenantSeats(tenantId);

      // Remove tenant record
      this.tenants.delete(tenantId);

      // Log audit event
      logger.audit('tenant_deleted', 'tenant', deletedBy, {
        tenantId,
        tenantName: tenant.name,
      });

      logger.info('Tenant deleted successfully:', tenantId);
      return {
        id: tenantId,
        name: tenant.name,
        deleted: true,
        deletedAt: new Date(),
      };
    } catch (error) {
      logger.error('Failed to delete tenant:', error);
      throw error;
    }
  }

  /**
   * Get tenant statistics
   */
  async getTenantStats(tenantId) {
    try {
      logger.info('Getting tenant statistics:', tenantId);

      const tenant = this.tenants.get(tenantId);
      if (!tenant) {
        throw new TenantNotFoundError(tenantId);
      }

      const seatUsage = await this.seatService.getTenantSeatUsage(tenantId);
      
      // In a real implementation, you would query actual user data
      const stats = {
        tenantId,
        totalUsers: tenant.seatUsed,
        activeUsers: Math.floor(tenant.seatUsed * 0.85),
        blockedUsers: Math.floor(tenant.seatUsed * 0.05),
        pendingUsers: Math.floor(tenant.seatUsed * 0.1),
        seatUtilization: seatUsage.utilizationPercentage,
        lastUserCreated: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
        lastLogin: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000),
        createdAt: tenant.createdAt,
        status: tenant.status,
      };

      return stats;
    } catch (error) {
      logger.error('Failed to get tenant statistics:', error);
      throw error;
    }
  }

  /**
   * Validate tenant access for a user
   */
  async validateTenantAccess(userToken, tenantId) {
    try {
      logger.info('Validating tenant access:', { tenantId, userId: userToken.sub });

      // Check if tenant exists
      const tenant = this.tenants.get(tenantId);
      if (!tenant) {
        throw new TenantNotFoundError(tenantId);
      }

      // Check if tenant is active
      if (tenant.status !== 'active') {
        throw new BusinessLogicError(`Tenant ${tenantId} is not active`, {
          tenantId,
          status: tenant.status,
        });
      }

      // Check if user belongs to this tenant or is a master admin
      const userTenantId = userToken.tenant_id;
      const isMasterAdmin = userToken.isMasterAdmin || 
                           (userToken.roles && userToken.roles.includes('master_admin'));

      if (!isMasterAdmin && userTenantId !== tenantId) {
        throw new UnauthorizedTenantAccessError(tenantId, {
          userId: userToken.sub,
          userTenantId,
        });
      }

      return {
        valid: true,
        tenant,
        userAccess: {
          isMasterAdmin,
          tenantId: userTenantId,
          roles: userToken.roles || [],
        },
      };
    } catch (error) {
      logger.error('Failed to validate tenant access:', error);
      throw error;
    }
  }

  /**
   * Find tenant by domain
   */
  async findTenantByDomain(domain) {
    try {
      for (const tenant of this.tenants.values()) {
        if (tenant.domain === domain) {
          return tenant;
        }
      }
      return null;
    } catch (error) {
      logger.error('Failed to find tenant by domain:', error);
      throw error;
    }
  }

  /**
   * Validate tenant data
   */
  validateTenantData(tenantData) {
    const errors = [];

    if (!tenantData.name || tenantData.name.trim().length < 2) {
      errors.push('Tenant name must be at least 2 characters long');
    }

    if (!tenantData.domain || !/^[a-z0-9-]+$/.test(tenantData.domain)) {
      errors.push('Domain must contain only lowercase letters, numbers, and hyphens');
    }

    if (tenantData.seatLimit && (tenantData.seatLimit < 1 || tenantData.seatLimit > 10000)) {
      errors.push('Seat limit must be between 1 and 10000');
    }

    if (errors.length > 0) {
      throw new ValidationError('Tenant validation failed', { errors });
    }
  }

  /**
   * Validate tenant updates
   */
  validateTenantUpdates(updates) {
    const errors = [];

    if (updates.name && updates.name.trim().length < 2) {
      errors.push('Tenant name must be at least 2 characters long');
    }

    if (updates.seatLimit && (updates.seatLimit < 1 || updates.seatLimit > 10000)) {
      errors.push('Seat limit must be between 1 and 10000');
    }

    if (updates.status && !['active', 'suspended', 'inactive'].includes(updates.status)) {
      errors.push('Status must be one of: active, suspended, inactive');
    }

    if (errors.length > 0) {
      throw new ValidationError('Tenant update validation failed', { errors });
    }
  }
}

module.exports = TenantService;