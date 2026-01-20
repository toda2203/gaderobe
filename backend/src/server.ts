import app from './app';
import { config } from './config';
import logger from './utils/logger';
import { initializeDatabase } from './utils/database';
import { scheduleEntraIdSync } from './scheduler/entraid-sync.scheduler';
import { backupScheduler } from './scheduler/backup.scheduler';
import https from 'https';
import fs from 'fs';
import path from 'path';

const startServer = async () => {
  try {
    // Initialize Database
    await initializeDatabase();
    logger.info('Database initialized successfully');

    // Start Entra ID sync scheduler
    scheduleEntraIdSync();

    // Start Backup scheduler
    await backupScheduler.initialize();
    logger.info('Backup scheduler initialized');

    // Start Server with HTTPS
    const certPath = path.join(process.cwd(), 'cert.pfx');
    if (!fs.existsSync(certPath)) {
      logger.error('Certificate not found at ' + certPath);
      process.exit(1);
    }

    const pfx = fs.readFileSync(certPath);
    const httpsOptions = {
      pfx,
      passphrase: 'password123',
    };

    const server = https.createServer(httpsOptions, app).listen(config.port, config.host, () => {
      logger.info(`🚀 Server running on https://${config.host}:${config.port}`);
      logger.info(`📝 Environment: ${config.env}`);
      logger.info(`🔒 CORS enabled for: ${config.corsOrigin}`);
      logger.info(`🔐 HTTPS enabled with self-signed certificate`);
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
