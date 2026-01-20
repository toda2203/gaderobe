import logger from '../utils/logger';
import { entraIdSyncService } from '../services/entraid-sync.service';

/**
 * Schedule automatic Entra ID sync
 * Syncs employees from Entra ID every hour
 */
export function scheduleEntraIdSync() {
  try {
    // Run initial sync on server startup (after 5 seconds delay)
    setTimeout(async () => {
      logger.info('Running initial Entra ID sync...');
      try {
        await entraIdSyncService.syncUsersFromEntraId();
        logger.info('Initial Entra ID sync completed');
      } catch (error) {
        logger.error('Initial Entra ID sync failed:', error);
      }
    }, 5000);

    // Schedule recurring sync every hour
    setInterval(async () => {
      logger.info('Running scheduled Entra ID sync...');
      try {
        const result = await entraIdSyncService.syncUsersFromEntraId();
        logger.info('Scheduled Entra ID sync completed:', result);
      } catch (error) {
        logger.error('Scheduled Entra ID sync failed:', error);
      }
    }, 60 * 60 * 1000); // 1 hour

    logger.info('Entra ID sync scheduler initialized');
  } catch (error) {
    logger.error('Failed to initialize Entra ID sync scheduler:', error);
  }
}
