import app from './app';
import { config } from './config';
import logger from './utils/logger';
import { initializeDatabase } from './utils/database';
import { backupScheduler } from './scheduler/backup.scheduler';
import http from 'http';

const startServer = async () => {
  try {
    // Initialize Database
    await initializeDatabase();
    logger.info('Database initialized successfully');


    // Start Backup scheduler
    await backupScheduler.initialize();
    logger.info('Backup scheduler initialized');

    // Starte Server im Entwicklungsmodus mit HTTP
    const server = http.createServer(app).listen(config.port, config.host, () => {
      logger.info(`🚀 Server running on http://${config.host}:${config.port}`);
      logger.info(`📝 Environment: ${config.env}`);
      logger.info(`🔒 CORS enabled for: ${config.corsOrigin}`);
    });

    // Graceful Shutdown
    const gracefulShutdown = async (signal: string) => {
      logger.info(`${signal} received. Starting graceful shutdown...`);

      server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
      });

      // Force close after 10 seconds
      setTimeout(() => {
        logger.error('Forcing shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
