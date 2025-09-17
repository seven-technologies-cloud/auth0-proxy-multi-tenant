const logger = require('../utils/logger');
const { SeatLimitExceededError, TenantNotFoundError, BusinessLogicError } = require('../utils/errors');
const config = require('../config');
const fs = require('fs').promises;
const path = require('path');

class SeatService {
  constructor() {
    // Use file-based storage for persistence
    this.storageFile = path.join(process.cwd(), 'data', 'tenant-seats.json');
    this.tenantSeats = new Map();
    this.initializeService();
  }

  /**
   * Initialize the seat service
   */
  async initializeService() {
    try {
      await this.loadSeatData();
      logger.info('Seat service initialized with persistent storage');
    } catch (error) {
      logger.warn('Failed to load seat data, starting with empty storage:', error.message);
      // Ensure data directory exists
      await this.ensureDataDirectory();
    }
  }

  /**
   * Ensure data directory exists
   */
  async ensureDataDirectory() {
    try {
      const dataDir = path.dirname(this.storageFile);
      await fs.mkdir(dataDir, { recursive: true });
    } catch (error) {
      logger.error('Failed to create data directory:', error);
    }
  }

  /**
   * Load seat data from persistent storage
   */
  async loadSeatData() {
    try {
      await this.ensureDataDirectory();
      const data = await fs.readFile(this.storageFile, 'utf8');
      const seatData = JSON.parse(data);
      
      // Convert back to Map
      this.tenantSeats = new Map(Object.entries(seatData));
      logger.info(`Loaded seat data for ${this.tenantSeats.size} tenants`);
    } catch (error) {
      if (error.code === 'ENOENT') {
        // File doesn't exist yet, start with empty Map
        this.tenantSeats = new Map();
        logger.info('No existing seat data found, starting with empty storage');
      } else {
        throw error;
      }
    }
  }

  /**
   * Save seat data to persistent storage
   */
  async saveSeatData() {
    try {
      await this.ensureDataDirectory();
      const data = Object.fromEntries(this.tenantSeats);
      await fs.writeFile(this.storageFile, JSON.stringify(data, null, 2));
      logger.debug('Seat data saved to persistent storage');
    } catch (error) {
      logger.error('Failed to save seat data:', error);
      // Don't throw error to avoid breaking the main operation
    }
  }

  /**
   * Get seat usage for a tenant
   */
  async getTenantSeatUsage(tenantId) {
    try {
      logger.info('Getting seat usage for tenant:', tenantId);

      // In a real implementation, this would query your database
      const seatData = this.tenantSeats.get(tenantId) || {
        tenantId,
        seatLimit: config.seats.defaultLimit,
        seatUsed: 0,
        availableSeats: config.seats.defaultLimit,
        lastUpdated: new Date(),
      };

      return {
        tenantId: seatData.tenantId,
        seatLimit: seatData.seatLimit,
        seatUsed: seatData.seatUsed,
        availableSeats: seatData.seatLimit - seatData.seatUsed,
        utilizationPercentage: Math.round((seatData.seatUsed / seatData.seatLimit) * 100),
        lastUpdated: seatData.lastUpdated,
      };
    } catch (error) {
      logger.error('Failed to get tenant seat usage:', error);
      throw error;
    }
  }

  /**
   * Check if seats are available for a tenant
   */
  async checkSeatAvailability(tenantId, requestedSeats = 1) {
    try {
      logger.info(`Checking seat availability for tenant ${tenantId}, requested: ${requestedSeats}`);

      const seatUsage = await this.getTenantSeatUsage(tenantId);
      const available = seatUsage.availableSeats >= requestedSeats;

      return {
        available,
        requestedSeats,
        availableSeats: seatUsage.availableSeats,
        seatLimit: seatUsage.seatLimit,
        seatUsed: seatUsage.seatUsed,
      };
    } catch (error) {
      logger.error('Failed to check seat availability:', error);
      throw error;
    }
  }

  /**
   * Reserve seats for a tenant
   */
  async reserveSeats(tenantId, seatsToReserve = 1) {
    try {
      logger.info(`Reserving ${seatsToReserve} seats for tenant: ${tenantId}`);

      const availability = await this.checkSeatAvailability(tenantId, seatsToReserve);
      
      if (!availability.available) {
        throw new SeatLimitExceededError(
          tenantId,
          availability.seatUsed,
          availability.seatLimit,
          {
            requestedSeats: seatsToReserve,
            availableSeats: availability.availableSeats,
          }
        );
      }

      // Update seat usage
      const currentData = this.tenantSeats.get(tenantId) || {
        tenantId,
        seatLimit: config.seats.defaultLimit,
        seatUsed: 0,
      };

      const updatedData = {
        ...currentData,
        seatUsed: currentData.seatUsed + seatsToReserve,
        lastUpdated: new Date(),
      };

      this.tenantSeats.set(tenantId, updatedData);
      await this.saveSeatData();

      logger.info(`Successfully reserved ${seatsToReserve} seats for tenant: ${tenantId}`);

      return {
        tenantId,
        seatsReserved: seatsToReserve,
        totalSeatUsed: updatedData.seatUsed,
        availableSeats: updatedData.seatLimit - updatedData.seatUsed,
        seatLimit: updatedData.seatLimit,
      };
    } catch (error) {
      logger.error('Failed to reserve seats:', error);
      throw error;
    }
  }

  /**
   * Release seats for a tenant
   */
  async releaseSeats(tenantId, seatsToRelease = 1) {
    try {
      logger.info(`Releasing ${seatsToRelease} seats for tenant: ${tenantId}`);

      const currentData = this.tenantSeats.get(tenantId);
      
      if (!currentData) {
        // If tenant doesn't exist in seat data, log warning and return success
        // This can happen if tenant was deleted or never properly initialized
        logger.warn(`Tenant ${tenantId} not found in seat data during seat release. This may indicate the tenant was deleted or never initialized.`, {
          operation: 'release_seats',
          seatsToRelease,
        });
        
        return {
          tenantId,
          seatsReleased: seatsToRelease,
          totalSeatUsed: 0,
          availableSeats: config.seats.defaultLimit,
          seatLimit: config.seats.defaultLimit,
          warning: 'Tenant not found in seat data - seat release assumed successful',
        };
      }

      if (currentData.seatUsed < seatsToRelease) {
        throw new BusinessLogicError(
          `Cannot release ${seatsToRelease} seats. Only ${currentData.seatUsed} seats are currently used.`,
          {
            tenantId,
            seatsToRelease,
            currentSeatUsed: currentData.seatUsed,
          }
        );
      }

      const updatedData = {
        ...currentData,
        seatUsed: Math.max(0, currentData.seatUsed - seatsToRelease),
        lastUpdated: new Date(),
      };

      this.tenantSeats.set(tenantId, updatedData);
      await this.saveSeatData();

      logger.info(`Successfully released ${seatsToRelease} seats for tenant: ${tenantId}`);

      return {
        tenantId,
        seatsReleased: seatsToRelease,
        totalSeatUsed: updatedData.seatUsed,
        availableSeats: updatedData.seatLimit - updatedData.seatUsed,
        seatLimit: updatedData.seatLimit,
      };
    } catch (error) {
      logger.error('Failed to release seats:', error);
      throw error;
    }
  }

  /**
   * Update seat limit for a tenant
   */
  async updateSeatLimit(tenantId, newLimit) {
    try {
      logger.info(`Updating seat limit for tenant ${tenantId} to ${newLimit}`);

      if (newLimit < 1) {
        throw new BusinessLogicError('Seat limit must be at least 1', {
          tenantId,
          newLimit,
        });
      }

      if (newLimit > config.seats.maxLimit) {
        throw new BusinessLogicError(
          `Seat limit cannot exceed maximum of ${config.seats.maxLimit}`,
          {
            tenantId,
            newLimit,
            maxLimit: config.seats.maxLimit,
          }
        );
      }

      const currentData = this.tenantSeats.get(tenantId) || {
        tenantId,
        seatLimit: config.seats.defaultLimit,
        seatUsed: 0,
      };

      // Check if new limit is less than currently used seats
      if (newLimit < currentData.seatUsed) {
        throw new BusinessLogicError(
          `Cannot set seat limit to ${newLimit}. Currently using ${currentData.seatUsed} seats.`,
          {
            tenantId,
            newLimit,
            currentSeatUsed: currentData.seatUsed,
          }
        );
      }

      const updatedData = {
        ...currentData,
        seatLimit: newLimit,
        lastUpdated: new Date(),
      };

      this.tenantSeats.set(tenantId, updatedData);
      await this.saveSeatData();

      logger.info(`Successfully updated seat limit for tenant ${tenantId} to ${newLimit}`);

      return {
        tenantId,
        previousLimit: currentData.seatLimit,
        newLimit,
        seatUsed: updatedData.seatUsed,
        availableSeats: newLimit - updatedData.seatUsed,
      };
    } catch (error) {
      logger.error('Failed to update seat limit:', error);
      throw error;
    }
  }

  /**
   * Get seat report for a tenant
   */
  async getSeatReport(tenantId) {
    try {
      logger.info('Generating seat report for tenant:', tenantId);

      const seatUsage = await this.getTenantSeatUsage(tenantId);
      
      // In a real implementation, you might also include historical data
      const report = {
        tenantId,
        currentUsage: seatUsage,
        recommendations: this.generateRecommendations(seatUsage),
        alerts: this.generateAlerts(seatUsage),
        generatedAt: new Date(),
      };

      return report;
    } catch (error) {
      logger.error('Failed to generate seat report:', error);
      throw error;
    }
  }

  /**
   * Generate recommendations based on seat usage
   */
  generateRecommendations(seatUsage) {
    const recommendations = [];
    const utilizationPercentage = seatUsage.utilizationPercentage;

    if (utilizationPercentage >= 90) {
      recommendations.push({
        type: 'warning',
        message: 'Seat utilization is very high. Consider increasing seat limit.',
        priority: 'high',
      });
    } else if (utilizationPercentage >= 75) {
      recommendations.push({
        type: 'info',
        message: 'Seat utilization is approaching limit. Monitor usage closely.',
        priority: 'medium',
      });
    } else if (utilizationPercentage <= 25) {
      recommendations.push({
        type: 'info',
        message: 'Seat utilization is low. Consider reducing seat limit to optimize costs.',
        priority: 'low',
      });
    }

    return recommendations;
  }

  /**
   * Generate alerts based on seat usage
   */
  generateAlerts(seatUsage) {
    const alerts = [];
    const utilizationPercentage = seatUsage.utilizationPercentage;

    if (utilizationPercentage >= 95) {
      alerts.push({
        type: 'critical',
        message: 'Seat limit almost reached. Immediate action required.',
        threshold: 95,
        current: utilizationPercentage,
      });
    } else if (utilizationPercentage >= 85) {
      alerts.push({
        type: 'warning',
        message: 'Seat usage is high. Consider increasing limit soon.',
        threshold: 85,
        current: utilizationPercentage,
      });
    }

    return alerts;
  }

  /**
   * Get seat statistics for all tenants (master tenant only)
   */
  async getAllTenantsSeatsStats() {
    try {
      logger.info('Getting seat statistics for all tenants');

      const stats = {
        totalTenants: this.tenantSeats.size,
        totalSeatsAllocated: 0,
        totalSeatsUsed: 0,
        averageUtilization: 0,
        tenantStats: [],
      };

      for (const [tenantId, seatData] of this.tenantSeats) {
        const tenantStats = {
          tenantId,
          seatLimit: seatData.seatLimit,
          seatUsed: seatData.seatUsed,
          utilizationPercentage: Math.round((seatData.seatUsed / seatData.seatLimit) * 100),
        };

        stats.tenantStats.push(tenantStats);
        stats.totalSeatsAllocated += seatData.seatLimit;
        stats.totalSeatsUsed += seatData.seatUsed;
      }

      if (stats.totalSeatsAllocated > 0) {
        stats.averageUtilization = Math.round((stats.totalSeatsUsed / stats.totalSeatsAllocated) * 100);
      }

      return stats;
    } catch (error) {
      logger.error('Failed to get all tenants seat statistics:', error);
      throw error;
    }
  }

  /**
   * Initialize tenant seats (called when a new tenant is created)
   */
  async initializeTenantSeats(tenantId, seatLimit = null) {
    try {
      const limit = seatLimit || config.seats.defaultLimit;
      
      logger.info(`Initializing seats for tenant ${tenantId} with limit: ${limit}`);

      const seatData = {
        tenantId,
        seatLimit: limit,
        seatUsed: 0,
        lastUpdated: new Date(),
      };

      this.tenantSeats.set(tenantId, seatData);
      await this.saveSeatData();

      return seatData;
    } catch (error) {
      logger.error('Failed to initialize tenant seats:', error);
      throw error;
    }
  }

  /**
   * Remove tenant seats (called when a tenant is deleted)
   */
  async removeTenantSeats(tenantId) {
    try {
      logger.info(`Removing seats for tenant: ${tenantId}`);
      
      const existed = this.tenantSeats.delete(tenantId);
      await this.saveSeatData();
      
      if (existed) {
        logger.info(`Successfully removed seats for tenant: ${tenantId}`);
      } else {
        logger.warn(`No seat data found for tenant: ${tenantId}`);
      }

      return { tenantId, removed: existed };
    } catch (error) {
      logger.error('Failed to remove tenant seats:', error);
      throw error;
    }
  }
}

module.exports = SeatService;