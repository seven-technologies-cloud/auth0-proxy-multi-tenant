// Extend Jest with additional matchers
require('jest-extended');

// Set up global test configuration
beforeAll(() => {
  // Set test timeout
  jest.setTimeout(10000);
  
  // Mock console methods to reduce noise during tests
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
});

// Clean up after each test
afterEach(() => {
  // Clear all mocks
  jest.clearAllMocks();
  
  // Reset all modules
  jest.resetModules();
  
  // Clear any timers
  jest.clearAllTimers();
  
  // Use real timers
  jest.useRealTimers();
});

// Clean up after all tests
afterAll(() => {
  // Restore all mocks
  jest.restoreAllMocks();
});

// Global test utilities
global.testUtils = {
  // Helper to wait for async operations
  wait: (ms = 0) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // Helper to create mock functions with return values
  mockFn: (returnValue) => jest.fn().mockReturnValue(returnValue),
  
  // Helper to create mock promises
  mockPromise: (resolveValue, rejectValue) => {
    if (rejectValue) {
      return jest.fn().mockRejectedValue(rejectValue);
    }
    return jest.fn().mockResolvedValue(resolveValue);
  },
  
  // Helper to suppress console output during tests
  suppressConsole: () => {
    const originalConsole = global.console;
    global.console = {
      ...console,
      log: () => {},
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    };
    return () => {
      global.console = originalConsole;
    };
  },
};

// Custom matchers
expect.extend({
  toBeValidDate(received) {
    const pass = received instanceof Date && !isNaN(received.getTime());
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid date`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid date`,
        pass: false,
      };
    }
  },
  
  toBeValidJWT(received) {
    const jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
    const pass = typeof received === 'string' && jwtRegex.test(received);
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid JWT`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid JWT`,
        pass: false,
      };
    }
  },
  
  toHaveValidationError(received, field) {
    const pass = received && 
                 received.details && 
                 received.details.validationErrors &&
                 received.details.validationErrors.some(error => error.field === field);
    if (pass) {
      return {
        message: () => `expected error not to have validation error for field ${field}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected error to have validation error for field ${field}`,
        pass: false,
      };
    }
  },
});

// Error handling for unhandled promise rejections in tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Error handling for uncaught exceptions in tests
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});