const SeatService = require('../../../src/services/seatService');
const { SeatLimitExceededError, TenantNotFoundError, BusinessLogicError } = require('../../../src/utils/errors');
const { seatUsageData } = require('../../fixtures/tenants');

// Mock the logger to avoid console output during tests
jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

// Mock the config
jest.mock('../../../src/config', () => ({
  seats: {
    defaultLimit: 10,
    maxLimit: 1000,
  },
}));

// Mock file system operations
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    mkdir: jest.fn(),
  },
}));

// Mock path
jest.mock('path', () => ({
  join: jest.fn((...args) => args.join('/')),
  dirname: jest.fn((path) => path.split('/').slice(0, -1).join('/')),
}));

describe('SeatService', () => {
  let seatService;

  beforeEach(async () => {
    // Mock file system operations to avoid actual file I/O
    const fs = require('fs');
    fs.promises.readFile.mockRejectedValue({ code: 'ENOENT' }); // File doesn't exist
    fs.promises.writeFile.mockResolvedValue();
    fs.promises.mkdir.mockResolvedValue();
    
    seatService = new SeatService();
    // Wait for initialization to complete
    await new Promise(resolve => setTimeout(resolve, 10));
    // Clear any existing tenant data
    seatService.tenantSeats.clear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getTenantSeatUsage', () => {
    test('should return default seat usage for new tenant', async () => {
      const tenantId = 'new_tenant_123';
      
      const result = await seatService.getTenantSeatUsage(tenantId);
      
      expect(result).toEqual({
        tenantId,
        seatLimit: 10,
        seatUsed: 0,
        availableSeats: 10,
        utilizationPercentage: 0,
        lastUpdated: expect.any(Date),
      });
    });

    test('should return existing seat usage for existing tenant', async () => {
      const tenantId = 'existing_tenant_123';
      const seatData = {
        tenantId,
        seatLimit: 50,
        seatUsed: 23,
        lastUpdated: new Date(),
      };
      
      seatService.tenantSeats.set(tenantId, seatData);
      
      const result = await seatService.getTenantSeatUsage(tenantId);
      
      expect(result).toEqual({
        tenantId,
        seatLimit: 50,
        seatUsed: 23,
        availableSeats: 27,
        utilizationPercentage: 46,
        lastUpdated: seatData.lastUpdated,
      });
    });

    test('should calculate utilization percentage correctly', async () => {
      const tenantId = 'test_tenant_123';
      const seatData = {
        tenantId,
        seatLimit: 100,
        seatUsed: 75,
        lastUpdated: new Date(),
      };
      
      seatService.tenantSeats.set(tenantId, seatData);
      
      const result = await seatService.getTenantSeatUsage(tenantId);
      
      expect(result.utilizationPercentage).toBe(75);
    });
  });

  describe('checkSeatAvailability', () => {
    test('should return true when seats are available', async () => {
      const tenantId = 'test_tenant_123';
      const seatData = {
        tenantId,
        seatLimit: 50,
        seatUsed: 20,
        lastUpdated: new Date(),
      };
      
      seatService.tenantSeats.set(tenantId, seatData);
      
      const result = await seatService.checkSeatAvailability(tenantId, 5);
      
      expect(result).toEqual({
        available: true,
        requestedSeats: 5,
        availableSeats: 30,
        seatLimit: 50,
        seatUsed: 20,
      });
    });

    test('should return false when not enough seats available', async () => {
      const tenantId = 'test_tenant_123';
      const seatData = {
        tenantId,
        seatLimit: 50,
        seatUsed: 48,
        lastUpdated: new Date(),
      };
      
      seatService.tenantSeats.set(tenantId, seatData);
      
      const result = await seatService.checkSeatAvailability(tenantId, 5);
      
      expect(result).toEqual({
        available: false,
        requestedSeats: 5,
        availableSeats: 2,
        seatLimit: 50,
        seatUsed: 48,
      });
    });

    test('should default to 1 seat when no requestedSeats provided', async () => {
      const tenantId = 'test_tenant_123';
      
      const result = await seatService.checkSeatAvailability(tenantId);
      
      expect(result.requestedSeats).toBe(1);
    });
  });

  describe('reserveSeats', () => {
    test('should successfully reserve seats when available', async () => {
      const tenantId = 'test_tenant_123';
      const seatData = {
        tenantId,
        seatLimit: 50,
        seatUsed: 20,
        lastUpdated: new Date(),
      };
      
      seatService.tenantSeats.set(tenantId, seatData);
      
      const result = await seatService.reserveSeats(tenantId, 5);
      
      expect(result).toEqual({
        tenantId,
        seatsReserved: 5,
        totalSeatUsed: 25,
        availableSeats: 25,
        seatLimit: 50,
      });
      
      // Verify the seat data was updated
      const updatedData = seatService.tenantSeats.get(tenantId);
      expect(updatedData.seatUsed).toBe(25);
    });

    test('should throw SeatLimitExceededError when not enough seats', async () => {
      const tenantId = 'test_tenant_123';
      const seatData = {
        tenantId,
        seatLimit: 50,
        seatUsed: 48,
        lastUpdated: new Date(),
      };
      
      seatService.tenantSeats.set(tenantId, seatData);
      
      await expect(seatService.reserveSeats(tenantId, 5))
        .rejects
        .toThrow(SeatLimitExceededError);
    });

    test('should default to 1 seat when no seatsToReserve provided', async () => {
      const tenantId = 'test_tenant_123';
      const seatData = {
        tenantId,
        seatLimit: 50,
        seatUsed: 20,
        lastUpdated: new Date(),
      };
      
      seatService.tenantSeats.set(tenantId, seatData);
      
      const result = await seatService.reserveSeats(tenantId);
      
      expect(result.seatsReserved).toBe(1);
      expect(result.totalSeatUsed).toBe(21);
    });

    test('should create new tenant data if tenant does not exist', async () => {
      const tenantId = 'new_tenant_123';
      
      const result = await seatService.reserveSeats(tenantId, 2);
      
      expect(result).toEqual({
        tenantId,
        seatsReserved: 2,
        totalSeatUsed: 2,
        availableSeats: 8,
        seatLimit: 10,
      });
      
      // Verify new tenant data was created
      const tenantData = seatService.tenantSeats.get(tenantId);
      expect(tenantData).toBeDefined();
      expect(tenantData.seatUsed).toBe(2);
    });
  });

  describe('releaseSeats', () => {
    test('should successfully release seats', async () => {
      const tenantId = 'test_tenant_123';
      const seatData = {
        tenantId,
        seatLimit: 50,
        seatUsed: 25,
        lastUpdated: new Date(),
      };
      
      seatService.tenantSeats.set(tenantId, seatData);
      
      const result = await seatService.releaseSeats(tenantId, 5);
      
      expect(result).toEqual({
        tenantId,
        seatsReleased: 5,
        totalSeatUsed: 20,
        availableSeats: 30,
        seatLimit: 50,
      });
      
      // Verify the seat data was updated
      const updatedData = seatService.tenantSeats.get(tenantId);
      expect(updatedData.seatUsed).toBe(20);
    });

    test('should return success with warning when tenant does not exist', async () => {
      const tenantId = 'nonexistent_tenant_123';
      
      const result = await seatService.releaseSeats(tenantId, 5);
      
      expect(result).toEqual({
        tenantId,
        seatsReleased: 5,
        totalSeatUsed: 0,
        availableSeats: 10, // default limit
        seatLimit: 10, // default limit
        warning: 'Tenant not found in seat data - seat release assumed successful',
      });
    });

    test('should throw BusinessLogicError when trying to release more seats than used', async () => {
      const tenantId = 'test_tenant_123';
      const seatData = {
        tenantId,
        seatLimit: 50,
        seatUsed: 3,
        lastUpdated: new Date(),
      };
      
      seatService.tenantSeats.set(tenantId, seatData);
      
      await expect(seatService.releaseSeats(tenantId, 5))
        .rejects
        .toThrow(BusinessLogicError);
    });

    test('should throw BusinessLogicError when trying to release more seats than used', async () => {
      const tenantId = 'test_tenant_123';
      const seatData = {
        tenantId,
        seatLimit: 50,
        seatUsed: 3,
        lastUpdated: new Date(),
      };
      
      seatService.tenantSeats.set(tenantId, seatData);
      
      await expect(seatService.releaseSeats(tenantId, 5))
        .rejects
        .toThrow(BusinessLogicError);
    });

    test('should default to 1 seat when no seatsToRelease provided', async () => {
      const tenantId = 'test_tenant_123';
      const seatData = {
        tenantId,
        seatLimit: 50,
        seatUsed: 25,
        lastUpdated: new Date(),
      };
      
      seatService.tenantSeats.set(tenantId, seatData);
      
      const result = await seatService.releaseSeats(tenantId);
      
      expect(result.seatsReleased).toBe(1);
      expect(result.totalSeatUsed).toBe(24);
    });
  });

  describe('updateSeatLimit', () => {
    test('should successfully update seat limit', async () => {
      const tenantId = 'test_tenant_123';
      const seatData = {
        tenantId,
        seatLimit: 50,
        seatUsed: 25,
        lastUpdated: new Date(),
      };
      
      seatService.tenantSeats.set(tenantId, seatData);
      
      const result = await seatService.updateSeatLimit(tenantId, 75);
      
      expect(result).toEqual({
        tenantId,
        previousLimit: 50,
        newLimit: 75,
        seatUsed: 25,
        availableSeats: 50,
      });
      
      // Verify the seat data was updated
      const updatedData = seatService.tenantSeats.get(tenantId);
      expect(updatedData.seatLimit).toBe(75);
    });

    test('should throw BusinessLogicError for invalid seat limit (less than 1)', async () => {
      const tenantId = 'test_tenant_123';
      
      await expect(seatService.updateSeatLimit(tenantId, 0))
        .rejects
        .toThrow(BusinessLogicError);
    });

    test('should throw BusinessLogicError for seat limit exceeding maximum', async () => {
      const tenantId = 'test_tenant_123';
      
      await expect(seatService.updateSeatLimit(tenantId, 1001))
        .rejects
        .toThrow(BusinessLogicError);
    });

    test('should throw BusinessLogicError when new limit is less than current usage', async () => {
      const tenantId = 'test_tenant_123';
      const seatData = {
        tenantId,
        seatLimit: 50,
        seatUsed: 30,
        lastUpdated: new Date(),
      };
      
      seatService.tenantSeats.set(tenantId, seatData);
      
      await expect(seatService.updateSeatLimit(tenantId, 25))
        .rejects
        .toThrow(BusinessLogicError);
    });

    test('should create new tenant data if tenant does not exist', async () => {
      const tenantId = 'new_tenant_123';
      
      const result = await seatService.updateSeatLimit(tenantId, 30);
      
      expect(result).toEqual({
        tenantId,
        previousLimit: 10, // Default limit
        newLimit: 30,
        seatUsed: 0,
        availableSeats: 30,
      });
    });
  });

  describe('getSeatReport', () => {
    test('should generate comprehensive seat report', async () => {
      const tenantId = 'test_tenant_123';
      const seatData = {
        tenantId,
        seatLimit: 50,
        seatUsed: 45, // 90% utilization
        lastUpdated: new Date(),
      };
      
      seatService.tenantSeats.set(tenantId, seatData);
      
      const result = await seatService.getSeatReport(tenantId);
      
      expect(result).toEqual({
        tenantId,
        currentUsage: {
          tenantId,
          seatLimit: 50,
          seatUsed: 45,
          availableSeats: 5,
          utilizationPercentage: 90,
          lastUpdated: seatData.lastUpdated,
        },
        recommendations: expect.arrayContaining([
          expect.objectContaining({
            type: 'warning',
            priority: 'high',
          }),
        ]),
        alerts: expect.arrayContaining([
          expect.objectContaining({
            type: 'warning',
            threshold: 85,
            current: 90,
          }),
        ]),
        generatedAt: expect.any(Date),
      });
    });

    test('should generate recommendations for high utilization', async () => {
      const tenantId = 'test_tenant_123';
      const seatData = {
        tenantId,
        seatLimit: 100,
        seatUsed: 95, // 95% utilization
        lastUpdated: new Date(),
      };
      
      seatService.tenantSeats.set(tenantId, seatData);
      
      const result = await seatService.getSeatReport(tenantId);
      
      expect(result.recommendations).toContainEqual(
        expect.objectContaining({
          type: 'warning',
          message: 'Seat utilization is very high. Consider increasing seat limit.',
          priority: 'high',
        })
      );
    });

    test('should generate recommendations for low utilization', async () => {
      const tenantId = 'test_tenant_123';
      const seatData = {
        tenantId,
        seatLimit: 100,
        seatUsed: 10, // 10% utilization
        lastUpdated: new Date(),
      };
      
      seatService.tenantSeats.set(tenantId, seatData);
      
      const result = await seatService.getSeatReport(tenantId);
      
      expect(result.recommendations).toContainEqual(
        expect.objectContaining({
          type: 'info',
          message: 'Seat utilization is low. Consider reducing seat limit to optimize costs.',
          priority: 'low',
        })
      );
    });

    test('should generate critical alerts for very high utilization', async () => {
      const tenantId = 'test_tenant_123';
      const seatData = {
        tenantId,
        seatLimit: 100,
        seatUsed: 97, // 97% utilization
        lastUpdated: new Date(),
      };
      
      seatService.tenantSeats.set(tenantId, seatData);
      
      const result = await seatService.getSeatReport(tenantId);
      
      expect(result.alerts).toContainEqual(
        expect.objectContaining({
          type: 'critical',
          message: 'Seat limit almost reached. Immediate action required.',
          threshold: 95,
          current: 97,
        })
      );
    });
  });

  describe('getAllTenantsSeatsStats', () => {
    test('should return stats for all tenants', async () => {
      // Set up multiple tenants
      seatService.tenantSeats.set('tenant_1', {
        tenantId: 'tenant_1',
        seatLimit: 50,
        seatUsed: 25,
        lastUpdated: new Date(),
      });
      
      seatService.tenantSeats.set('tenant_2', {
        tenantId: 'tenant_2',
        seatLimit: 30,
        seatUsed: 15,
        lastUpdated: new Date(),
      });
      
      const result = await seatService.getAllTenantsSeatsStats();
      
      expect(result).toEqual({
        totalTenants: 2,
        totalSeatsAllocated: 80,
        totalSeatsUsed: 40,
        averageUtilization: 50,
        tenantStats: expect.arrayContaining([
          expect.objectContaining({
            tenantId: 'tenant_1',
            seatLimit: 50,
            seatUsed: 25,
            utilizationPercentage: 50,
          }),
          expect.objectContaining({
            tenantId: 'tenant_2',
            seatLimit: 30,
            seatUsed: 15,
            utilizationPercentage: 50,
          }),
        ]),
      });
    });

    test('should return empty stats when no tenants exist', async () => {
      const result = await seatService.getAllTenantsSeatsStats();
      
      expect(result).toEqual({
        totalTenants: 0,
        totalSeatsAllocated: 0,
        totalSeatsUsed: 0,
        averageUtilization: 0,
        tenantStats: [],
      });
    });
  });

  describe('initializeTenantSeats', () => {
    test('should initialize tenant seats with default limit', async () => {
      const tenantId = 'new_tenant_123';
      
      const result = await seatService.initializeTenantSeats(tenantId);
      
      expect(result).toEqual({
        tenantId,
        seatLimit: 10,
        seatUsed: 0,
        lastUpdated: expect.any(Date),
      });
      
      // Verify tenant was added to the map
      expect(seatService.tenantSeats.has(tenantId)).toBe(true);
    });

    test('should initialize tenant seats with custom limit', async () => {
      const tenantId = 'new_tenant_123';
      const customLimit = 25;
      
      const result = await seatService.initializeTenantSeats(tenantId, customLimit);
      
      expect(result.seatLimit).toBe(customLimit);
    });
  });

  describe('removeTenantSeats', () => {
    test('should successfully remove existing tenant seats', async () => {
      const tenantId = 'test_tenant_123';
      const seatData = {
        tenantId,
        seatLimit: 50,
        seatUsed: 25,
        lastUpdated: new Date(),
      };
      
      seatService.tenantSeats.set(tenantId, seatData);
      
      const result = await seatService.removeTenantSeats(tenantId);
      
      expect(result).toEqual({
        tenantId,
        removed: true,
      });
      
      // Verify tenant was removed from the map
      expect(seatService.tenantSeats.has(tenantId)).toBe(false);
    });

    test('should return false when tenant does not exist', async () => {
      const tenantId = 'nonexistent_tenant_123';
      
      const result = await seatService.removeTenantSeats(tenantId);
      
      expect(result).toEqual({
        tenantId,
        removed: false,
      });
    });
  });

  describe('generateRecommendations', () => {
    test('should generate high priority warning for very high utilization', () => {
      const seatUsage = { utilizationPercentage: 95 };
      
      const recommendations = seatService.generateRecommendations(seatUsage);
      
      expect(recommendations).toContainEqual(
        expect.objectContaining({
          type: 'warning',
          priority: 'high',
          message: 'Seat utilization is very high. Consider increasing seat limit.',
        })
      );
    });

    test('should generate medium priority info for high utilization', () => {
      const seatUsage = { utilizationPercentage: 80 };
      
      const recommendations = seatService.generateRecommendations(seatUsage);
      
      expect(recommendations).toContainEqual(
        expect.objectContaining({
          type: 'info',
          priority: 'medium',
          message: 'Seat utilization is approaching limit. Monitor usage closely.',
        })
      );
    });

    test('should generate low priority info for low utilization', () => {
      const seatUsage = { utilizationPercentage: 20 };
      
      const recommendations = seatService.generateRecommendations(seatUsage);
      
      expect(recommendations).toContainEqual(
        expect.objectContaining({
          type: 'info',
          priority: 'low',
          message: 'Seat utilization is low. Consider reducing seat limit to optimize costs.',
        })
      );
    });

    test('should return empty recommendations for normal utilization', () => {
      const seatUsage = { utilizationPercentage: 50 };
      
      const recommendations = seatService.generateRecommendations(seatUsage);
      
      expect(recommendations).toEqual([]);
    });
  });

  describe('generateAlerts', () => {
    test('should generate critical alert for very high utilization', () => {
      const seatUsage = { utilizationPercentage: 97 };
      
      const alerts = seatService.generateAlerts(seatUsage);
      
      expect(alerts).toContainEqual(
        expect.objectContaining({
          type: 'critical',
          message: 'Seat limit almost reached. Immediate action required.',
          threshold: 95,
          current: 97,
        })
      );
    });

    test('should generate warning alert for high utilization', () => {
      const seatUsage = { utilizationPercentage: 88 };
      
      const alerts = seatService.generateAlerts(seatUsage);
      
      expect(alerts).toContainEqual(
        expect.objectContaining({
          type: 'warning',
          message: 'Seat usage is high. Consider increasing limit soon.',
          threshold: 85,
          current: 88,
        })
      );
    });

    test('should return empty alerts for normal utilization', () => {
      const seatUsage = { utilizationPercentage: 70 };
      
      const alerts = seatService.generateAlerts(seatUsage);
      
      expect(alerts).toEqual([]);
    });
  });

  describe('Error Handling', () => {
    test('should handle errors gracefully in getTenantSeatUsage', async () => {
      // Mock an error in the method
      const originalGet = seatService.tenantSeats.get;
      seatService.tenantSeats.get = jest.fn().mockImplementation(() => {
        throw new Error('Database error');
      });
      
      await expect(seatService.getTenantSeatUsage('test_tenant'))
        .rejects
        .toThrow('Database error');
      
      // Restore original method
      seatService.tenantSeats.get = originalGet;
    });
  });

  describe('Edge Cases', () => {
    test('should handle zero seat limit correctly', async () => {
      const tenantId = 'test_tenant_123';
      
      await expect(seatService.updateSeatLimit(tenantId, 0))
        .rejects
        .toThrow(BusinessLogicError);
    });

    test('should handle exact seat limit usage', async () => {
      const tenantId = 'test_tenant_123';
      const seatData = {
        tenantId,
        seatLimit: 10,
        seatUsed: 10,
        lastUpdated: new Date(),
      };
      
      seatService.tenantSeats.set(tenantId, seatData);
      
      const availability = await seatService.checkSeatAvailability(tenantId, 1);
      
      expect(availability.available).toBe(false);
      expect(availability.availableSeats).toBe(0);
    });
  });
});