import { Router } from 'express';
import { authenticate, authorize, AuthenticatedRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { emailService, EmailService } from '../services/email.service';
import { masterDataService } from '../services/master-data.service';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);

/**
 * GET /api/system/dashboard-stats
 * Get dashboard statistics
 */
router.get(
  '/dashboard-stats',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const user = req.user!;

    // Count items by status
    const [
      totalItems,
      activeItems,
      issuedItems,
      retiredItems,
      totalEmployees,
      activeEmployees,
      totalTypes,
      activeTypes,
    ] = await Promise.all([
      prisma.clothingItem.count(),
      prisma.clothingItem.count({ where: { status: 'AVAILABLE' } }),
      prisma.clothingItem.count({ where: { status: 'ISSUED' } }),
      prisma.clothingItem.count({ where: { status: 'RETIRED' } }),
      prisma.employee.count(),
      prisma.employee.count({ where: { status: 'ACTIVE' } }),
      prisma.clothingType.count(),
      prisma.clothingType.count({ where: { isActive: true } }),
    ]);

    // Get recent transactions (last 10)
    const recentTransactions = await prisma.transaction.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        clothingItem: {
          select: {
            internalId: true,
            type: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    // Get top clothing types by count
    const topTypes = await prisma.clothingItem.groupBy({
      by: ['typeId'],
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
      take: 5,
    });

    // Get type details for top types
    const topTypesWithDetails = await Promise.all(
      topTypes.map(async (t) => {
        const type = await prisma.clothingType.findUnique({
          where: { id: t.typeId },
          select: { name: true },
        });
        return {
          typeId: t.typeId,
          name: type?.name || 'Unbekannt',
          count: t._count.id,
          costPrice: 0,
        };
      })
    );

    // Calculate total value (placeholder - costPrice field doesn't exist)
    const totalValue = 0;
    const activeValue = 0;

    res.json({
      success: true,
      data: {
        items: {
          total: totalItems,
          active: activeItems,
          issued: issuedItems,
          retired: retiredItems,
        },
        employees: {
          total: totalEmployees,
          active: activeEmployees,
        },
        types: {
          total: totalTypes,
          active: activeTypes,
        },
        value: {
          total: totalValue,
          active: activeValue,
        },
        topTypes: topTypesWithDetails,
        recentTransactions: recentTransactions.map(t => ({
          id: t.id,
          type: t.type,
          employeeName: `${t.employee.firstName} ${t.employee.lastName}`,
          itemNumber: t.clothingItem?.internalId || 'N/A',
          typeName: t.clothingItem?.type.name || 'N/A',
          createdAt: t.createdAt,
        })),
      },
    });
  })
);

/**
 * POST /api/system/test-email
 * Send test email (ADMIN only)
 */
router.post(
  '/test-email',
  authorize('ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { testEmail } = req.body;

    if (!testEmail) {
      return res.status(400).json({
        success: false,
        error: 'Test-Email-Adresse ist erforderlich',
      });
    }

    try {
      // Test connection first
      const connectionTest = await emailService.testConnection();
      
      if (!connectionTest) {
        return res.status(500).json({
          success: false,
          error: 'SMTP-Verbindung fehlgeschlagen. Bitte prüfen Sie die Email-Konfiguration in der .env Datei.',
        });
      }

      // Send test email
      const testEmailSent = await emailService.sendTestEmail(testEmail);

      if (testEmailSent) {
        res.json({
          success: true,
          message: `Test-Email erfolgreich an ${testEmail} gesendet`,
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Test-Email konnte nicht gesendet werden. Bitte prüfen Sie die SMTP-Konfiguration.',
        });
      }
    } catch (error: any) {
      console.error('Test email error:', error);
      res.status(500).json({
        success: false,
        error: `Email-Test fehlgeschlagen: ${error.message}`,
      });
    }
  })
);

/**
 * GET /api/system/email-config
 * Get email configuration status (ADMIN only)
 */
router.get(
  '/email-config',
  authorize('ADMIN'),
  asyncHandler(async (req, res) => {
    const config = {
      smtpHost: process.env.SMTP_HOST || 'Nicht konfiguriert',
      smtpPort: process.env.SMTP_PORT || 'Nicht konfiguriert',
      smtpUser: process.env.SMTP_USER || 'Nicht konfiguriert',
      smtpFrom: process.env.SMTP_FROM || 'Nicht konfiguriert',
      hasPassword: !!process.env.SMTP_PASS,
    };

    res.json({
      success: true,
      data: config,
    });
  })
);

/**

/**
 * POST /api/system/master-data/:type
 * Add a new master data item (ADMIN only)
 */
router.post(
  '/master-data/:type',
  authorize('ADMIN'),
  asyncHandler(async (req, res) => {
    const { type } = req.params;
    const { value } = req.body;

    if (!['SIZE', 'CATEGORY', 'DEPARTMENT'].includes(type.toUpperCase())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid type',
      });
    }

    if (!value || typeof value !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Value is required',
      });
    }

    await masterDataService.addItem(type.toUpperCase() as any, value);

    const items = await masterDataService.getByType(type.toUpperCase() as any);

    res.json({
      success: true,
      data: items,
    });
  })
);

/**
 * DELETE /api/system/master-data/:type/:value
 * Delete a master data item (ADMIN only)
 */
router.delete(
  '/master-data/:type/:value',
  authorize('ADMIN'),
  asyncHandler(async (req, res) => {
    const { type, value } = req.params;

    if (!['SIZE', 'CATEGORY', 'DEPARTMENT'].includes(type.toUpperCase())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid type',
      });
    }

    await masterDataService.removeItem(type.toUpperCase() as any, decodeURIComponent(value));

    const items = await masterDataService.getByType(type.toUpperCase() as any);

    res.json({
      success: true,
      data: items,
    });
  })
);

/**
 * PUT /api/system/master-data/:type/reorder
 * Reorder master data items (ADMIN only)
 */
router.put(
  '/master-data/:type/reorder',
  authorize('ADMIN'),
  asyncHandler(async (req, res) => {
    const { type } = req.params;
    const { items } = req.body;

    if (!['SIZE', 'CATEGORY', 'DEPARTMENT'].includes(type.toUpperCase())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid type',
      });
    }

    if (!Array.isArray(items)) {
      return res.status(400).json({
        success: false,
        error: 'Items must be an array',
      });
    }

    await masterDataService.reorderItems(type.toUpperCase() as any, items);

    res.json({
      success: true,
      data: items,
    });
  })
);

// Email Configuration
router.get(
  '/email-config',
  authorize('ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const config = EmailService.getEmailMode();
    res.json({
      success: true,
      data: config,
    });
  })
);

router.post(
  '/email-config',
  authorize('ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { mode, testAddress } = req.body;

    if (!['production', 'development'].includes(mode)) {
      return res.status(400).json({
        success: false,
        error: 'Mode must be either "production" or "development"',
      });
    }

    EmailService.setEmailMode(mode, testAddress);
    const config = EmailService.getEmailMode();

    res.json({
      success: true,
      message: `Email mode changed to ${mode}`,
      data: config,
    });
  })
);

/**
 * GET /api/system/audit-logs
 * Get audit log entries (ADMIN only)
 */
router.get(
  '/audit-logs',
  authorize('ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const {
      page = '1',
      limit = '50',
      entityType,
      action,
      performedById,
      startDate,
      endDate,
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Build filter
    const where: any = {};
    
    if (entityType) {
      where.entityType = entityType;
    }
    
    if (action) {
      where.action = action;
    }
    
    if (performedById) {
      where.performedById = performedById;
    }
    
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) {
        where.timestamp.gte = new Date(startDate as string);
      }
      if (endDate) {
        where.timestamp.lte = new Date(endDate as string);
      }
    }

    // Get logs with employee info
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          performedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
        orderBy: {
          timestamp: 'desc',
        },
        skip,
        take: limitNum,
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        logs,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      },
    });
  })
);

export default router;