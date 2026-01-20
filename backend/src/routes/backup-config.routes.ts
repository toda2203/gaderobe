import { Router } from 'express';
import { authenticate, authorize, AuthenticatedRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import prisma from '../utils/database';
import { backupScheduler } from '../scheduler/backup.scheduler';

const router = Router();

router.use(authenticate);
router.use(authorize('ADMIN'));

/**
 * GET /api/backup-config
 * Get all backup configurations
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const configs = await prisma.backupConfiguration.findMany({
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: configs,
    });
  })
);

/**
 * GET /api/backup-config/:id
 * Get single backup configuration
 */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const config = await prisma.backupConfiguration.findUnique({
      where: { id },
    });

    if (!config) {
      return res.status(404).json({
        success: false,
        error: 'Backup-Konfiguration nicht gefunden',
      });
    }

    res.json({
      success: true,
      data: config,
    });
  })
);

/**
 * POST /api/backup-config
 * Create new backup configuration
 */
router.post(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const {
      enabled,
      frequency,
      hour,
      minute,
      dayOfWeek,
      dayOfMonth,
      retentionDays,
      includeImages,
      includeProtocols,
      notifyOnSuccess,
      notifyOnError,
      notificationEmail,
    } = req.body;

    // Validation
    if (!frequency || !['DAILY', 'WEEKLY', 'MONTHLY'].includes(frequency)) {
      return res.status(400).json({
        success: false,
        error: 'Ungültige Frequenz. Erlaubt: DAILY, WEEKLY, MONTHLY',
      });
    }

    if (hour === undefined || hour < 0 || hour > 23) {
      return res.status(400).json({
        success: false,
        error: 'Stunde muss zwischen 0 und 23 liegen',
      });
    }

    if (minute !== undefined && (minute < 0 || minute > 59)) {
      return res.status(400).json({
        success: false,
        error: 'Minute muss zwischen 0 und 59 liegen',
      });
    }

    // Build cron expression
    let schedule: string;
    const min = minute ?? 0;

    switch (frequency) {
      case 'DAILY':
        schedule = `${min} ${hour} * * *`;
        break;
      case 'WEEKLY':
        const dow = dayOfWeek ?? 0;
        if (dow < 0 || dow > 6) {
          return res.status(400).json({
            success: false,
            error: 'Tag der Woche muss zwischen 0 (Sonntag) und 6 (Samstag) liegen',
          });
        }
        schedule = `${min} ${hour} * * ${dow}`;
        break;
      case 'MONTHLY':
        const dom = dayOfMonth ?? 1;
        if (dom < 1 || dom > 31) {
          return res.status(400).json({
            success: false,
            error: 'Tag des Monats muss zwischen 1 und 31 liegen',
          });
        }
        schedule = `${min} ${hour} ${dom} * *`;
        break;
      default:
        schedule = `${min} ${hour} * * *`;
    }

    const config = await prisma.backupConfiguration.create({
      data: {
        enabled: enabled ?? false,
        schedule,
        frequency,
        hour,
        minute: min,
        dayOfWeek: frequency === 'WEEKLY' ? dayOfWeek : null,
        dayOfMonth: frequency === 'MONTHLY' ? dayOfMonth : null,
        retentionDays: retentionDays ?? 30,
        includeImages: includeImages ?? true,
        includeProtocols: includeProtocols ?? true,
        notifyOnSuccess: notifyOnSuccess ?? true,
        notifyOnError: notifyOnError ?? true,
        notificationEmail,
      },
    });

    // Schedule backup if enabled
    if (config.enabled) {
      await backupScheduler.scheduleBackup(config);
    }

    res.status(201).json({
      success: true,
      data: config,
    });
  })
);

/**
 * PUT /api/backup-config/:id
 * Update backup configuration
 */
router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const {
      enabled,
      frequency,
      hour,
      minute,
      dayOfWeek,
      dayOfMonth,
      retentionDays,
      includeImages,
      includeProtocols,
      notifyOnSuccess,
      notifyOnError,
      notificationEmail,
    } = req.body;

    const existingConfig = await prisma.backupConfiguration.findUnique({
      where: { id },
    });

    if (!existingConfig) {
      return res.status(404).json({
        success: false,
        error: 'Backup-Konfiguration nicht gefunden',
      });
    }

    // Build new cron expression
    let schedule: string | undefined;
    if (frequency && hour !== undefined) {
      const min = minute ?? 0;
      switch (frequency) {
        case 'DAILY':
          schedule = `${min} ${hour} * * *`;
          break;
        case 'WEEKLY':
          schedule = `${min} ${hour} * * ${dayOfWeek ?? 0}`;
          break;
        case 'MONTHLY':
          schedule = `${min} ${hour} ${dayOfMonth ?? 1} * *`;
          break;
      }
    }

    const config = await prisma.backupConfiguration.update({
      where: { id },
      data: {
        enabled: enabled !== undefined ? enabled : undefined,
        schedule: schedule || undefined,
        frequency: frequency || undefined,
        hour: hour !== undefined ? hour : undefined,
        minute: minute !== undefined ? minute : undefined,
        dayOfWeek: frequency === 'WEEKLY' ? dayOfWeek : null,
        dayOfMonth: frequency === 'MONTHLY' ? dayOfMonth : null,
        retentionDays: retentionDays !== undefined ? retentionDays : undefined,
        includeImages: includeImages !== undefined ? includeImages : undefined,
        includeProtocols: includeProtocols !== undefined ? includeProtocols : undefined,
        notifyOnSuccess: notifyOnSuccess !== undefined ? notifyOnSuccess : undefined,
        notifyOnError: notifyOnError !== undefined ? notifyOnError : undefined,
        notificationEmail: notificationEmail !== undefined ? notificationEmail : undefined,
      },
    });

    // Reschedule backup
    backupScheduler.stopBackup(id);
    if (config.enabled) {
      await backupScheduler.scheduleBackup(config);
    }

    res.json({
      success: true,
      data: config,
    });
  })
);

/**
 * DELETE /api/backup-config/:id
 * Delete backup configuration
 */
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const config = await prisma.backupConfiguration.findUnique({
      where: { id },
    });

    if (!config) {
      return res.status(404).json({
        success: false,
        error: 'Backup-Konfiguration nicht gefunden',
      });
    }

    // Stop scheduler
    backupScheduler.stopBackup(id);

    await prisma.backupConfiguration.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: 'Backup-Konfiguration gelöscht',
    });
  })
);

/**
 * POST /api/backup-config/:id/toggle
 * Toggle backup enabled/disabled
 */
router.post(
  '/:id/toggle',
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const config = await prisma.backupConfiguration.findUnique({
      where: { id },
    });

    if (!config) {
      return res.status(404).json({
        success: false,
        error: 'Backup-Konfiguration nicht gefunden',
      });
    }

    const updated = await prisma.backupConfiguration.update({
      where: { id },
      data: { enabled: !config.enabled },
    });

    // Reschedule
    backupScheduler.stopBackup(id);
    if (updated.enabled) {
      await backupScheduler.scheduleBackup(updated);
    }

    res.json({
      success: true,
      data: updated,
    });
  })
);

/**
 * POST /api/backup-config/:id/run-now
 * Manually trigger backup
 */
router.post(
  '/:id/run-now',
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const config = await prisma.backupConfiguration.findUnique({
      where: { id },
    });

    if (!config) {
      return res.status(404).json({
        success: false,
        error: 'Backup-Konfiguration nicht gefunden',
      });
    }

    // Execute backup asynchronously
    backupScheduler.executeBackup(id).catch((error) => {
      console.error('Manual backup execution error:', error);
    });

    res.json({
      success: true,
      message: 'Backup wird ausgeführt...',
    });
  })
);

/**
 * GET /api/backup-config/scheduler/status
 * Get scheduler status
 */
router.get(
  '/scheduler/status',
  asyncHandler(async (req, res) => {
    const status = backupScheduler.getStatus();

    res.json({
      success: true,
      data: status,
    });
  })
);

export default router;
