const winston = require('winston');
const config = require('../config');

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint()
);

// Create logger instance
const logger = winston.createLogger({
  level: config.logging.level,
  format: logFormat,
  defaultMeta: {
    service: 'auth0-proxy-api',
    version: process.env.npm_package_version || '1.0.0'
  },
  transports: [
    // Write all logs with level 'error' and below to error.log
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Write all logs with level 'info' and below to combined.log
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
});

// If we're not in production, log to the console as well
if (config.server.env !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple(),
      winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
        let metaStr = '';
        if (Object.keys(meta).length > 0) {
          metaStr = JSON.stringify(meta, null, 2);
        }
        return `${timestamp} [${service}] ${level}: ${message} ${metaStr}`;
      })
    )
  }));
}

// Create logs directory if it doesn't exist
const fs = require('fs');
const path = require('path');
const logsDir = path.join(process.cwd(), 'logs');

if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Add request logging helper
logger.logRequest = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection.remoteAddress,
    };

    if (req.user) {
      logData.userId = req.user.sub;
      logData.tenantId = req.body?.tenantId || req.query?.tenantId || 'unknown';
    }

    if (res.statusCode >= 400) {
      logger.warn('HTTP Request', logData);
    } else {
      logger.info('HTTP Request', logData);
    }
  });

  next();
};

// Add error logging helper
logger.logError = (error, req = null) => {
  const errorData = {
    message: error.message,
    stack: error.stack,
    name: error.name,
  };

  if (req) {
    errorData.request = {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.body,
      params: req.params,
      query: req.query,
    };

    if (req.user) {
      errorData.user = {
        id: req.user.sub,
        tenantId: req.body?.tenantId || req.query?.tenantId || 'unknown',
      };
    }
  }

  logger.error('Application Error', errorData);
};

// Add audit logging helper
logger.audit = (action, resource, user, details = {}) => {
  logger.info('Audit Log', {
    action,
    resource,
    user: {
      id: user.sub || user.id,
      email: user.email,
      tenantId: user.tenant_id,
    },
    details,
    timestamp: new Date().toISOString(),
  });
};

module.exports = logger;