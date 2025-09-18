import config from '../config/env.js';

/**
 * Centralized error handling middleware
 * Normalizes all errors into consistent JSON format
 */
export function errorHandler(err, req, res, next) {
  const correlationId = req.headers['x-correlation-id'] || req.correlationId || 'unknown';
  
  // Log error details
  console.error('Error occurred:', {
    correlationId,
    error: err.message,
    stack: config.api.nodeEnv === 'development' ? err.stack : undefined,
    url: req.url,
    method: req.method,
    statusCode: err.statusCode,
    code: err.code,
  });

  // Default error response
  let statusCode = err.statusCode || 500;
  let errorCode = err.code || 'INTERNAL_ERROR';
  let message = err.message || 'Internal server error';
  let details = err.details;

  // Handle specific error types
  if (err.name === 'ValidationError') {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    message = 'Request validation failed';
    details = err.details || err.message;
  } else if (err.name === 'CastError') {
    statusCode = 400;
    errorCode = 'INVALID_ID';
    message = 'Invalid ID format';
  } else if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') {
    statusCode = 503;
    errorCode = 'SERVICE_UNAVAILABLE';
    message = 'External service unavailable';
  }

  // Don't expose internal error details in production
  if (config.api.nodeEnv === 'production' && statusCode >= 500) {
    message = 'Internal server error';
    details = undefined;
  }

  const errorResponse = {
    error: {
      code: errorCode,
      message,
      correlationId,
    },
  };

  // Include details if available and appropriate
  if (details && (config.api.nodeEnv === 'development' || statusCode < 500)) {
    errorResponse.error.details = details;
  }

  res.status(statusCode).json(errorResponse);
}

/**
 * 404 Not Found handler
 */
export function notFoundHandler(req, res) {
  const correlationId = req.headers['x-correlation-id'] || req.correlationId || 'unknown';
  
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
      correlationId,
    },
  });
}

/**
 * Async error wrapper for route handlers
 * Catches async errors and passes them to error middleware
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}