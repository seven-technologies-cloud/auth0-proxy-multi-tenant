const {
  Auth0ProxyError,
  AuthenticationError,
  InvalidTokenError,
  MissingTokenError,
  AuthorizationError,
  UnauthorizedTenantAccessError,
  InsufficientPermissionsError,
  ValidationError,
  InvalidRequestError,
  ResourceNotFoundError,
  TenantNotFoundError,
  UserNotFoundError,
  ConflictError,
  DuplicateResourceError,
  DuplicateEmailError,
  TenantAlreadyExistsError,
  BusinessLogicError,
  SeatLimitExceededError,
  TenantInactiveError,
  ExternalServiceError,
  Auth0ApiError,
  RateLimitError,
  InternalServerError,
  ServiceUnavailableError,
  ErrorFactory,
} = require('../../../src/utils/errors');

describe('Error Classes', () => {
  describe('Auth0ProxyError (Base Error)', () => {
    test('should create error with default values', () => {
      const error = new Auth0ProxyError('Test error');
      
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('Auth0ProxyError');
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('INTERNAL_ERROR');
      expect(error.details).toBeNull();
      expect(error.timestamp).toBeValidDate();
    });

    test('should create error with custom values', () => {
      const details = { field: 'test' };
      const error = new Auth0ProxyError('Custom error', 400, 'CUSTOM_ERROR', details);
      
      expect(error.message).toBe('Custom error');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('CUSTOM_ERROR');
      expect(error.details).toEqual(details);
    });

    test('should serialize to JSON correctly', () => {
      const error = new Auth0ProxyError('Test error', 400, 'TEST_ERROR', { test: true });
      const json = error.toJSON();
      
      expect(json).toEqual({
        error: {
          name: 'Auth0ProxyError',
          message: 'Test error',
          code: 'TEST_ERROR',
          statusCode: 400,
          details: { test: true },
          timestamp: error.timestamp,
        },
      });
    });
  });

  describe('AuthenticationError', () => {
    test('should create authentication error with correct defaults', () => {
      const error = new AuthenticationError();
      
      expect(error).toBeInstanceOf(Auth0ProxyError);
      expect(error.name).toBe('AuthenticationError');
      expect(error.message).toBe('Authentication failed');
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('AUTHENTICATION_ERROR');
    });

    test('should create authentication error with custom message', () => {
      const error = new AuthenticationError('Custom auth error', { userId: '123' });
      
      expect(error.message).toBe('Custom auth error');
      expect(error.details).toEqual({ userId: '123' });
    });
  });

  describe('InvalidTokenError', () => {
    test('should create invalid token error', () => {
      const error = new InvalidTokenError();
      
      expect(error).toBeInstanceOf(AuthenticationError);
      expect(error.code).toBe('INVALID_TOKEN');
      expect(error.message).toBe('Invalid or expired token');
      expect(error.statusCode).toBe(401);
    });
  });

  describe('MissingTokenError', () => {
    test('should create missing token error', () => {
      const error = new MissingTokenError();
      
      expect(error).toBeInstanceOf(AuthenticationError);
      expect(error.code).toBe('MISSING_TOKEN');
      expect(error.message).toBe('Authorization token is required');
      expect(error.statusCode).toBe(401);
    });
  });

  describe('AuthorizationError', () => {
    test('should create authorization error with correct defaults', () => {
      const error = new AuthorizationError();
      
      expect(error).toBeInstanceOf(Auth0ProxyError);
      expect(error.name).toBe('AuthorizationError');
      expect(error.message).toBe('Access denied');
      expect(error.statusCode).toBe(403);
      expect(error.code).toBe('AUTHORIZATION_ERROR');
    });
  });

  describe('UnauthorizedTenantAccessError', () => {
    test('should create unauthorized tenant access error without tenant ID', () => {
      const error = new UnauthorizedTenantAccessError();
      
      expect(error).toBeInstanceOf(AuthorizationError);
      expect(error.code).toBe('UNAUTHORIZED_TENANT_ACCESS');
      expect(error.message).toBe('Unauthorized access to tenant resources');
    });

    test('should create unauthorized tenant access error with tenant ID', () => {
      const error = new UnauthorizedTenantAccessError('tenant_123');
      
      expect(error.message).toBe('Unauthorized access to tenant: tenant_123');
    });
  });

  describe('InsufficientPermissionsError', () => {
    test('should create insufficient permissions error', () => {
      const requiredPermissions = ['read:users', 'write:users'];
      const error = new InsufficientPermissionsError(requiredPermissions);
      
      expect(error).toBeInstanceOf(AuthorizationError);
      expect(error.code).toBe('INSUFFICIENT_PERMISSIONS');
      expect(error.message).toBe('Insufficient permissions. Required: read:users, write:users');
    });
  });

  describe('ValidationError', () => {
    test('should create validation error with correct defaults', () => {
      const error = new ValidationError();
      
      expect(error).toBeInstanceOf(Auth0ProxyError);
      expect(error.name).toBe('ValidationError');
      expect(error.message).toBe('Validation failed');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('InvalidRequestError', () => {
    test('should create invalid request error', () => {
      const error = new InvalidRequestError('email', 'Invalid format');
      
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.code).toBe('INVALID_REQUEST');
      expect(error.message).toBe('Invalid email: Invalid format');
      expect(error.field).toBe('email');
    });
  });

  describe('ResourceNotFoundError', () => {
    test('should create resource not found error without ID', () => {
      const error = new ResourceNotFoundError('User');
      
      expect(error).toBeInstanceOf(Auth0ProxyError);
      expect(error.name).toBe('ResourceNotFoundError');
      expect(error.message).toBe('User not found');
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('RESOURCE_NOT_FOUND');
      expect(error.resource).toBe('User');
      expect(error.resourceId).toBeNull();
    });

    test('should create resource not found error with ID', () => {
      const error = new ResourceNotFoundError('User', 'user_123');
      
      expect(error.message).toBe("User with ID 'user_123' not found");
      expect(error.resourceId).toBe('user_123');
    });
  });

  describe('TenantNotFoundError', () => {
    test('should create tenant not found error', () => {
      const error = new TenantNotFoundError('tenant_123');
      
      expect(error).toBeInstanceOf(ResourceNotFoundError);
      expect(error.code).toBe('TENANT_NOT_FOUND');
      expect(error.message).toBe("Tenant with ID 'tenant_123' not found");
    });
  });

  describe('UserNotFoundError', () => {
    test('should create user not found error', () => {
      const error = new UserNotFoundError('user_123');
      
      expect(error).toBeInstanceOf(ResourceNotFoundError);
      expect(error.code).toBe('USER_NOT_FOUND');
      expect(error.message).toBe("User with ID 'user_123' not found");
    });
  });

  describe('SeatLimitExceededError', () => {
    test('should create seat limit exceeded error', () => {
      const error = new SeatLimitExceededError('tenant_123', 10, 10);
      
      expect(error).toBeInstanceOf(BusinessLogicError);
      expect(error.code).toBe('SEAT_LIMIT_EXCEEDED');
      expect(error.message).toBe('Seat limit exceeded for tenant tenant_123. Current: 10, Max: 10');
      expect(error.tenantId).toBe('tenant_123');
      expect(error.currentSeats).toBe(10);
      expect(error.maxSeats).toBe(10);
    });
  });

  describe('DuplicateEmailError', () => {
    test('should create duplicate email error', () => {
      const error = new DuplicateEmailError('test@example.com');
      
      expect(error).toBeInstanceOf(DuplicateResourceError);
      expect(error.code).toBe('DUPLICATE_EMAIL');
      expect(error.message).toBe("User with email 'test@example.com' already exists");
    });
  });

  describe('Auth0ApiError', () => {
    test('should create Auth0 API error', () => {
      const error = new Auth0ApiError('API error', 502);
      
      expect(error).toBeInstanceOf(ExternalServiceError);
      expect(error.code).toBe('AUTH0_API_ERROR');
      expect(error.message).toBe('Auth0 API: API error');
      expect(error.statusCode).toBe(502);
    });
  });

  describe('RateLimitError', () => {
    test('should create rate limit error', () => {
      const error = new RateLimitError('Rate limit exceeded', 60);
      
      expect(error).toBeInstanceOf(Auth0ProxyError);
      expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(error.statusCode).toBe(429);
      expect(error.retryAfter).toBe(60);
    });
  });

  describe('ErrorFactory', () => {
    describe('fromAuth0Error', () => {
      test('should create ValidationError for 400 status', () => {
        const auth0Error = {
          statusCode: 400,
          message: 'Bad Request',
          error: 'invalid_request',
          error_description: 'Invalid email format',
        };

        const error = ErrorFactory.fromAuth0Error(auth0Error);
        
        expect(error).toBeInstanceOf(ValidationError);
        expect(error.message).toBe('Invalid email format');
        expect(error.details.auth0Error).toBe('invalid_request');
      });

      test('should create AuthenticationError for 401 status', () => {
        const auth0Error = {
          statusCode: 401,
          message: 'Unauthorized',
          error: 'unauthorized',
          error_description: 'Invalid credentials',
        };

        const error = ErrorFactory.fromAuth0Error(auth0Error);
        
        expect(error).toBeInstanceOf(AuthenticationError);
        expect(error.message).toBe('Invalid credentials');
      });

      test('should create AuthorizationError for 403 status', () => {
        const auth0Error = {
          statusCode: 403,
          message: 'Forbidden',
          error: 'forbidden',
          error_description: 'Access denied',
        };

        const error = ErrorFactory.fromAuth0Error(auth0Error);
        
        expect(error).toBeInstanceOf(AuthorizationError);
        expect(error.message).toBe('Access denied');
      });

      test('should create ResourceNotFoundError for 404 status', () => {
        const auth0Error = {
          statusCode: 404,
          message: 'Not Found',
          error: 'not_found',
          error_description: 'User not found',
        };

        const error = ErrorFactory.fromAuth0Error(auth0Error);
        
        expect(error).toBeInstanceOf(ResourceNotFoundError);
        expect(error.message).toBe('User not found');
      });

      test('should create ConflictError for 409 status', () => {
        const auth0Error = {
          statusCode: 409,
          message: 'Conflict',
          error: 'conflict',
          error_description: 'User already exists',
        };

        const error = ErrorFactory.fromAuth0Error(auth0Error);
        
        expect(error).toBeInstanceOf(ConflictError);
        expect(error.message).toBe('User already exists');
      });

      test('should create RateLimitError for 429 status', () => {
        const auth0Error = {
          statusCode: 429,
          message: 'Too Many Requests',
          error: 'rate_limit_exceeded',
          error_description: 'Rate limit exceeded',
        };

        const error = ErrorFactory.fromAuth0Error(auth0Error);
        
        expect(error).toBeInstanceOf(RateLimitError);
        expect(error.message).toBe('Rate limit exceeded');
      });

      test('should create Auth0ApiError for unknown status codes', () => {
        const auth0Error = {
          statusCode: 500,
          message: 'Internal Server Error',
          error: 'server_error',
          error_description: 'Something went wrong',
        };

        const error = ErrorFactory.fromAuth0Error(auth0Error);
        
        expect(error).toBeInstanceOf(Auth0ApiError);
        expect(error.message).toBe('Something went wrong');
        expect(error.statusCode).toBe(500);
      });
    });

    describe('fromValidationError', () => {
      test('should create error from Joi validation result', () => {
        const validationResult = {
          errors: [
            {
              path: ['email'],
              message: 'Email is required',
              field: 'email',
            },
          ],
        };

        const error = ErrorFactory.fromValidationError(validationResult);
        
        expect(error).toBeInstanceOf(InvalidRequestError);
        expect(error.message).toBe('Invalid email: Email is required');
        expect(error.field).toBe('email');
      });

      test('should create error from express-validator result', () => {
        const validationResult = {
          details: [
            {
              field: 'name',
              message: 'Name is required',
            },
          ],
        };

        const error = ErrorFactory.fromValidationError(validationResult);
        
        expect(error).toBeInstanceOf(InvalidRequestError);
        expect(error.message).toBe('Invalid name: Name is required');
      });

      test('should create generic validation error when no specific errors', () => {
        const validationResult = {};

        const error = ErrorFactory.fromValidationError(validationResult);
        
        expect(error).toBeInstanceOf(ValidationError);
        expect(error.message).toBe('Request validation failed');
      });
    });
  });

  describe('Error Inheritance', () => {
    test('should maintain proper inheritance chain', () => {
      const invalidTokenError = new InvalidTokenError();
      
      expect(invalidTokenError).toBeInstanceOf(InvalidTokenError);
      expect(invalidTokenError).toBeInstanceOf(AuthenticationError);
      expect(invalidTokenError).toBeInstanceOf(Auth0ProxyError);
      expect(invalidTokenError).toBeInstanceOf(Error);
    });

    test('should maintain proper inheritance for business logic errors', () => {
      const seatError = new SeatLimitExceededError('tenant_123', 10, 10);
      
      expect(seatError).toBeInstanceOf(SeatLimitExceededError);
      expect(seatError).toBeInstanceOf(BusinessLogicError);
      expect(seatError).toBeInstanceOf(Auth0ProxyError);
      expect(seatError).toBeInstanceOf(Error);
    });
  });

  describe('Error Stack Traces', () => {
    test('should capture stack trace correctly', () => {
      const error = new Auth0ProxyError('Test error');
      
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('Auth0ProxyError');
      expect(error.stack).toContain('Test error');
    });
  });

  describe('Error Details', () => {
    test('should handle complex error details', () => {
      const complexDetails = {
        validationErrors: [
          { field: 'email', message: 'Invalid format' },
          { field: 'name', message: 'Too short' },
        ],
        requestId: 'req_123',
        userId: 'user_456',
      };

      const error = new ValidationError('Multiple validation errors', complexDetails);
      
      expect(error.details).toEqual(complexDetails);
      expect(error.toJSON().error.details).toEqual(complexDetails);
    });
  });
});