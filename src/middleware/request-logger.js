import pino from 'pino';
import pinoHttp from 'pino-http';
import { randomUUID } from 'crypto';

/**
 * Pino logger configuration
 */
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    },
  } : undefined,
});

/**
 * HTTP request logger middleware using pino-http
 * Adds correlation ID to all requests and logs request/response details
 */
export const requestLogger = pinoHttp({
  logger,
  genReqId: (req) => {
    // Use existing correlation ID from header or generate new one
    return req.headers['x-correlation-id'] || randomUUID();
  },
  customLogLevel: (req, res, err) => {
    if (res.statusCode >= 400 && res.statusCode < 500) {
      return 'warn';
    } else if (res.statusCode >= 500 || err) {
      return 'error';
    }
    return 'info';
  },
  customSuccessMessage: (req, res) => {
    return `${req.method} ${req.url} - ${res.statusCode}`;
  },
  customErrorMessage: (req, res, err) => {
    return `${req.method} ${req.url} - ${res.statusCode} - ${err.message}`;
  },
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
      headers: {
        'user-agent': req.headers['user-agent'],
        'x-correlation-id': req.headers['x-correlation-id'],
        'authorization': req.headers.authorization ? '[REDACTED]' : undefined,
      },
      remoteAddress: req.remoteAddress,
      remotePort: req.remotePort,
    }),
    res: (res) => ({
      statusCode: res.statusCode,
      headers: {
        'content-type': res.getHeader ? res.getHeader('content-type') : res.headers?.['content-type'],
        'content-length': res.getHeader ? res.getHeader('content-length') : res.headers?.['content-length'],
      },
    }),
  },
});

/**
 * Correlation ID middleware
 * Ensures every request has a correlation ID for tracing
 */
export function correlationId(req, res, next) {
  const correlationId = req.headers['x-correlation-id'] || randomUUID();
  
  // Set correlation ID on request for use in other middleware/controllers
  req.correlationId = correlationId;
  
  // Set response header
  res.setHeader('X-Correlation-ID', correlationId);
  
  next();
}

export { logger };