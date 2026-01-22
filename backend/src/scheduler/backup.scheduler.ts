import cron from 'node-cron';
import prisma from '../utils/database';
import { exportService } from '../services/export.service';
import { emailService } from '../services/email.service';
import logger from '../utils/logger';
import fs from 'fs';
import path from 'path';

class BackupScheduler {
  private scheduledTasks: Map<string, cron.ScheduledTask> = new Map();

  /**
   * Initialize backup scheduler - load all enabled configs and start cron jobs
   */
  async initialize() {
    try {
      logger.info('[BackupScheduler] Initializing automatic backup scheduler...');

      const configs = await prisma.backupConfiguration.findMany({
        where: { enabled: true },
      });

      if (configs.length === 0) {
        logger.info('[BackupScheduler] No enabled backup configurations found');
        return;
      }

      for (const config of configs) {
        await this.scheduleBackup(config);
      }

      logger.info(`[BackupScheduler] Initialized ${configs.length} backup schedule(s)`);
    } catch (error) {
      logger.error('[BackupScheduler] Failed to initialize:', error);
    }
  }

  /**
   * Schedule a backup based on configuration
   */
  async scheduleBackup(config: any) {
    try {
      // Stop existing task if any
      this.stopBackup(config.id);

      // Calculate cron expression
      const cronExpression = this.buildCronExpression(config);
      logger.info(`[BackupScheduler] Scheduling backup ${config.id} with cron: ${cronExpression}`);

      // Create cron job
      const task = cron.schedule(cronExpression, async () => {
        await this.executeBackup(config.id);
      });

      this.scheduledTasks.set(config.id, task);

      // Calculate and update next run time
      await this.updateNextRunTime(config.id, cronExpression);

      logger.info(`[BackupScheduler] Backup ${config.id} scheduled successfully`);
    } catch (error) {
      logger.error(`[BackupScheduler] Failed to schedule backup ${config.id}:`, error);
    }
  }

  /**
   * Stop a scheduled backup
   */
  stopBackup(configId: string) {
    const task = this.scheduledTasks.get(configId);
    if (task) {
      task.stop();
      this.scheduledTasks.delete(configId);
      logger.info(`[BackupScheduler] Stopped backup ${configId}`);
    }
  }

  /**
   * Execute backup for a configuration
   */
  async executeBackup(configId: string) {
    const startTime = Date.now();
    logger.info(`[BackupScheduler] Starting backup execution for ${configId}`);

    try {
      // Get latest config
      const config = await prisma.backupConfiguration.findUnique({
        where: { id: configId },
      });

      if (!config || !config.enabled) {
        logger.warn(`[BackupScheduler] Backup ${configId} is disabled or not found, skipping`);
        return;
      }

      // Create backup
      const buffer = await exportService.exportToCSVZip();

      // Save backup to file
      const backupDir = process.env.BACKUP_DIR || path.join(process.cwd(), 'backups');
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T').join('_').slice(0, -5);
      const filename = `auto-backup-${timestamp}.zip`;
      const filepath = path.join(backupDir, filename);

      fs.writeFileSync(filepath, buffer);

      const fileSize = (buffer.length / (1024 * 1024)).toFixed(2);
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      logger.info(`[BackupScheduler] Backup ${configId} completed: ${filename} (${fileSize} MB in ${duration}s)`);

      // Clean up old backups
      await this.cleanupOldBackups(config.retentionDays);

      // Update config
      await prisma.backupConfiguration.update({
        where: { id: configId },
        data: {
          lastRunAt: new Date(),
          lastRunSuccess: true,
          lastRunError: null,
        },
      });

      // Send success notification
      if (config.notifyOnSuccess && config.notificationEmail) {
        await this.sendNotificationEmail(
          config.notificationEmail,
          'success',
          filename,
          fileSize,
          duration
        );
      }

      // Calculate next run time
      await this.updateNextRunTime(configId, config.schedule);

    } catch (error: any) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      logger.error(`[BackupScheduler] Backup ${configId} failed after ${duration}s:`, error);

      // Update config with error
      const config = await prisma.backupConfiguration.findUnique({
        where: { id: configId },
      });

      if (config) {
        await prisma.backupConfiguration.update({
          where: { id: configId },
          data: {
            lastRunAt: new Date(),
            lastRunSuccess: false,
            lastRunError: error.message || 'Unknown error',
          },
        });

        // Send error notification
        if (config.notifyOnError && config.notificationEmail) {
          await this.sendNotificationEmail(
            config.notificationEmail,
            'error',
            null,
            null,
            duration,
            error.message
          );
        }
      }
    }
  }

  /**
   * Build cron expression from config
   */
  private buildCronExpression(config: any): string {
    const { frequency, minute, hour, dayOfWeek, dayOfMonth } = config;

    switch (frequency) {
      case 'DAILY':
        return `${minute} ${hour} * * *`;
      
      case 'WEEKLY':
        return `${minute} ${hour} * * ${dayOfWeek ?? 0}`;
      
      case 'MONTHLY':
        return `${minute} ${hour} ${dayOfMonth ?? 1} * *`;
      
      default:
        // Fallback to custom cron if provided
        return config.schedule || '0 2 * * *'; // Default: daily at 2 AM
    }
  }

  /**
   * Calculate next run time
   */
  private async updateNextRunTime(configId: string, cronExpression: string) {
    try {
      // Simple next run calculation (next occurrence)
      const now = new Date();
      const config = await prisma.backupConfiguration.findUnique({
        where: { id: configId },
      });

      if (!config) return;

      let nextRun: Date;

      switch (config.frequency) {
        case 'DAILY':
          nextRun = new Date(now);
          nextRun.setHours(config.hour, config.minute, 0, 0);
          if (nextRun <= now) {
            nextRun.setDate(nextRun.getDate() + 1);
          }
          break;

        case 'WEEKLY':
          nextRun = new Date(now);
          nextRun.setHours(config.hour, config.minute, 0, 0);
          const currentDay = nextRun.getDay();
          const targetDay = config.dayOfWeek ?? 0;
          let daysUntilNext = (targetDay - currentDay + 7) % 7;
          if (daysUntilNext === 0 && nextRun <= now) {
            daysUntilNext = 7;
          }
          nextRun.setDate(nextRun.getDate() + daysUntilNext);
          break;

        case 'MONTHLY':
          nextRun = new Date(now);
          nextRun.setDate(config.dayOfMonth ?? 1);
          nextRun.setHours(config.hour, config.minute, 0, 0);
          if (nextRun <= now) {
            nextRun.setMonth(nextRun.getMonth() + 1);
          }
          break;

        default:
          nextRun = new Date(now.getTime() + 24 * 60 * 60 * 1000); // +24h fallback
      }

      await prisma.backupConfiguration.update({
        where: { id: configId },
        data: { nextRunAt: nextRun },
      });

      logger.info(`[BackupScheduler] Next backup for ${configId} scheduled at ${nextRun.toISOString()}`);
    } catch (error) {
      logger.error(`[BackupScheduler] Failed to update next run time for ${configId}:`, error);
    }
  }

  /**
   * Clean up old backup files
   */
  private async cleanupOldBackups(retentionDays: number) {
    try {
      const backupDir = process.env.BACKUP_DIR || path.join(process.cwd(), 'backups');
      if (!fs.existsSync(backupDir)) return;

      const files = fs.readdirSync(backupDir);
      const now = Date.now();
      const retentionMs = retentionDays * 24 * 60 * 60 * 1000;

      let deletedCount = 0;

      for (const file of files) {
        if (!file.startsWith('auto-backup-') || !file.endsWith('.zip')) continue;

        const filepath = path.join(backupDir, file);
        const stats = fs.statSync(filepath);
        const age = now - stats.mtimeMs;

        if (age > retentionMs) {
          fs.unlinkSync(filepath);
          deletedCount++;
          logger.info(`[BackupScheduler] Deleted old backup: ${file}`);
        }
      }

      if (deletedCount > 0) {
        logger.info(`[BackupScheduler] Cleanup completed: ${deletedCount} old backup(s) deleted`);
      }
    } catch (error) {
      logger.error('[BackupScheduler] Failed to cleanup old backups:', error);
    }
  }

  /**
   * Send notification email
   */
  private async sendNotificationEmail(
    email: string,
    status: 'success' | 'error',
    filename: string | null,
    fileSize: string | null,
    duration: string,
    errorMessage?: string
  ) {
    try {
      const subject = status === 'success' 
        ? '✅ Automatisches Backup erfolgreich'
        : '❌ Automatisches Backup fehlgeschlagen';

      const htmlContent = status === 'success'
        ? `
          <h2>Backup erfolgreich erstellt</h2>
          <p>Das automatische Backup wurde erfolgreich durchgeführt.</p>
          <ul>
            <li><strong>Dateiname:</strong> ${filename}</li>
            <li><strong>Größe:</strong> ${fileSize} MB</li>
            <li><strong>Dauer:</strong> ${duration} Sekunden</li>
            <li><strong>Zeitpunkt:</strong> ${new Date().toLocaleString('de-DE')}</li>
          </ul>
        `
        : `
          <h2>Backup fehlgeschlagen</h2>
          <p>Das automatische Backup ist fehlgeschlagen.</p>
          <ul>
            <li><strong>Fehler:</strong> ${errorMessage || 'Unbekannter Fehler'}</li>
            <li><strong>Dauer:</strong> ${duration} Sekunden</li>
            <li><strong>Zeitpunkt:</strong> ${new Date().toLocaleString('de-DE')}</li>
          </ul>
          <p>Bitte prüfen Sie die Server-Logs für weitere Details.</p>
        `;

      await (emailService as any).sendEmail({
        to: email,
        subject,
        html: htmlContent,
      });

      logger.info(`[BackupScheduler] Notification email sent to ${email}`);
    } catch (error) {
      logger.error('[BackupScheduler] Failed to send notification email:', error);
    }
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      activeBackups: this.scheduledTasks.size,
      scheduledIds: Array.from(this.scheduledTasks.keys()),
    };
  }
}

// Export singleton instance
export const backupScheduler = new BackupScheduler();
