import app from './app.js';
import config from './config/env.js';
import { logger } from './middleware/request-logger.js';

/**
 * Server bootstrap
 * Starts the Express server and handles graceful shutdown
 */
const server = app.listen(config.api.port, () => {
  logger.info({
    message: 'Auth0 Management API Proxy started',
    port: config.api.port,
    nodeEnv: config.api.nodeEnv,
    auth0Domain: config.auth0.domain,
    allowedOrigins: config.cors.allowedOrigins,
    mgmtClientAllowlist: config.security.mgmtClientAllowlist,
  });
});

/**
 * Graceful shutdown handling
 */
const gracefulShutdown = (signal) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  
  server.close((err) => {
    if (err) {
      logger.error('Error during server shutdown:', err);
      process.exit(1);
    }
    
    logger.info('Server closed successfully');
    process.exit(0);
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions and unhandled rejections
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

export default server;