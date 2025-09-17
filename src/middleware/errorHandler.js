const logger = require('../utils/logger');
const config = require('../config');
const { Auth0ProxyError } = require('../utils/errors');

class ErrorHandler {
  /**
   * Main error handling middleware
   */
  static handle() {
    return (err, req, res, next) => {
      // Log the error
      logger.logError(err, req);

      // If response was already sent, delegate to default Express error handler
      if (res.headersSent) {
        return next(err);
      }

      // Generate request ID for tracking
      const requestId = req.id || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Handle Auth0ProxyError instances
      if (err instanceof Auth0ProxyError) {
        return ErrorHandler.handleAuth0ProxyError(err, req, res, requestId);
      }

      // Handle validation errors from express-validator
      if (err.name === 'ValidationError' && err.array) {
        return ErrorHandler.handleValidationError(err, req, res, requestId);
      }

      // Handle JWT errors
      if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
        return ErrorHandler.handleJWTError(err, req, res, requestId);
      }

      // Handle Auth0 API errors
      if (err.statusCode && err.error && err.error_description) {
        return ErrorHandler.handleAuth0ApiError(err, req, res, requestId);
      }

      // Handle MongoDB/Database errors
      if (err.name === 'MongoError' || err.name === 'CastError') {
        return ErrorHandler.handleDatabaseError(err, req, res, requestId);
      }

      // Handle rate limiting errors
      if (err.status === 429 || err.type === 'rate-limit') {
        return ErrorHandler.handleRateLimitError(err, req, res, requestId);
      }

      // Handle generic errors
      return ErrorHandler.handleGenericError(err, req, res, requestId);
    };
  }

  /**
   * Handle Auth0ProxyError instances
   */
  static handleAuth0ProxyError(err, req, res, requestId) {
    const errorResponse = {
      success: false,
      error: {
        code: err.code,
        message: err.message,
        statusCode: err.statusCode,
        timestamp: err.timestamp,
        requestId,
      },
    };

    // Add details in development mode or if configured
    if (config.errors.detailedErrors && err.details) {
      errorResponse.error.details = err.details;
    }

    // Add stack trace in development mode
    if (config.server.env === 'development' && config.errors.stackTraceEnabled) {
      errorResponse.error.stack = err.stack;
    }

    return res.status(err.statusCode).json(errorResponse);
  }

  /**
   * Handle validation errors
   */
  static handleValidationError(err, req, res, requestId) {
    const validationErrors = err.array ? err.array() : err.errors || [];
    
    const errorResponse = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        statusCode: 400,
        timestamp: new Date().toISOString(),
        requestId,
        details: {
          validationErrors: validationErrors.map(error => ({
            field: error.param || error.path,
            message: error.msg || error.message,
            value: error.value,
            location: error.location,
          })),
        },
      },
    };

    return res.status(400).json(errorResponse);
  }

  /**
   * Handle JWT errors
   */
  static handleJWTError(err, req, res, requestId) {
    let message = 'Token validation failed';
    let code = 'INVALID_TOKEN';

    if (err.name === 'TokenExpiredError') {
      message = 'Token has expired';
      code = 'TOKEN_EXPIRED';
    } else if (err.name === 'JsonWebTokenError') {
      message = 'Invalid token format';
      code = 'INVALID_TOKEN_FORMAT';
    }

    const errorResponse = {
      success: false,
      error: {
        code,
        message,
        statusCode: 401,
        timestamp: new Date().toISOString(),
        requestId,
      },
    };

    return res.status(401).json(errorResponse);
  }

  /**
   * Handle Auth0 API errors
   */
  static handleAuth0ApiError(err, req, res, requestId) {
    const statusCode = err.statusCode || 502;
    const message = err.error_description || err.message || 'Auth0 API error';

    const errorResponse = {
      success: false,
      error: {
        code: 'AUTH0_API_ERROR',
        message,
        statusCode,
        timestamp: new Date().toISOString(),
        requestId,
      },
    };

    // Add Auth0 error details in development
    if (config.errors.detailedErrors) {
      errorResponse.error.details = {
        auth0Error: err.error,
        auth0ErrorDescription: err.error_description,
        auth0StatusCode: err.statusCode,
      };
    }

    return res.status(statusCode).json(errorResponse);
  }

  /**
   * Handle database errors
   */
  static handleDatabaseError(err, req, res, requestId) {
    let message = 'Database operation failed';
    let statusCode = 500;

    if (err.name === 'CastError') {
      message = 'Invalid ID format';
      statusCode = 400;
    } else if (err.code === 11000) {
      message = 'Duplicate entry found';
      statusCode = 409;
    }

    const errorResponse = {
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message,
        statusCode,
        timestamp: new Date().toISOString(),
        requestId,
      },
    };

    return res.status(statusCode).json(errorResponse);
  }

  /**
   * Handle rate limiting errors
   */
  static handleRateLimitError(err, req, res, requestId) {
    const errorResponse = {
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please try again later.',
        statusCode: 429,
        timestamp: new Date().toISOString(),
        requestId,
      },
    };

    // Add retry-after header if available
    if (err.retryAfter) {
      res.set('Retry-After', err.retryAfter);
      errorResponse.error.retryAfter = err.retryAfter;
    }

    return res.status(429).json(errorResponse);
  }

  /**
   * Handle generic errors
   */
  static handleGenericError(err, req, res, requestId) {
    const statusCode = err.statusCode || err.status || 500;
    const message = statusCode === 500 ? 'Internal server error' : err.message;

    const errorResponse = {
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message,
        statusCode,
        timestamp: new Date().toISOString(),
        requestId,
      },
    };

    // Add error details in development mode
    if (config.server.env === 'development') {
      errorResponse.error.details = {
        originalError: err.message,
        name: err.name,
      };

      if (config.errors.stackTraceEnabled) {
        errorResponse.error.stack = err.stack;
      }
    }

    return res.status(statusCode).json(errorResponse);
  }

  /**
   * Handle 404 errors (route not found)
   */
  static notFound() {
    return (req, res, next) => {
      const requestId = req.id || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const errorResponse = {
        success: false,
        error: {
          code: 'ROUTE_NOT_FOUND',
          message: `Route ${req.method} ${req.originalUrl} not found`,
          statusCode: 404,
          timestamp: new Date().toISOString(),
          requestId,
        },
      };

      logger.warn('Route not found:', {
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        requestId,
      });

      res.status(404).json(errorResponse);
    };
  }

  /**
   * Async error wrapper for route handlers
   */
  static asyncHandler(fn) {
    return (req, res, next) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }

  /**
   * Create error response object
   */
  static createErrorResponse(code, message, statusCode = 500, details = null, requestId = null) {
    return {
      success: false,
      error: {
        code,
        message,
        statusCode,
        timestamp: new Date().toISOString(),
        requestId: requestId || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ...(details && { details }),
      },
    };
  }

  /**
   * Send error response
   */
  static sendError(res, code, message, statusCode = 500, details = null) {
    const errorResponse = ErrorHandler.createErrorResponse(code, message, statusCode, details);
    return res.status(statusCode).json(errorResponse);
  }

  /**
   * Handle uncaught exceptions
   */
  static handleUncaughtException() {
    process.on('uncaughtException', (err) => {
      logger.error('Uncaught Exception:', err);
      
      // Give the logger time to write the log
      setTimeout(() => {
        process.exit(1);
      }, 1000);
    });
  }

  /**
   * Handle unhandled promise rejections
   */
  static handleUnhandledRejection() {
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      
      // Give the logger time to write the log
      setTimeout(() => {
        process.exit(1);
      }, 1000);
    });
  }

  /**
   * Initialize global error handlers
   */
  static initialize() {
    ErrorHandler.handleUncaughtException();
    ErrorHandler.handleUnhandledRejection();
    
    logger.info('Global error handlers initialized');
  }
}

module.exports = ErrorHandler;