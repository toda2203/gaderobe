import { Router } from 'express';
import { authenticate, authorize, AuthenticatedRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { transactionService } from '../services/transaction.service';
import { emailService } from '../services/email.service';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);

/**
 * GET /api/transactions
 * Get all transactions with optional filtering
 */
router.get(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { employeeId, clothingItemId, type, returned } = req.query;
    const filters = {
      employeeId: employeeId as string,
      clothingItemId: clothingItemId as string,
      type: type as string,
      returned: returned === 'true' ? true : returned === 'false' ? false : undefined,
      requestingUserId: req.user!.id, // Pass current user ID
      requestingUserRole: req.user!.role, // Pass current user role
    };

    const transactions = await transactionService.getAllTransactions(filters);

    res.json({
      success: true,
      data: transactions,
    });
  })
);

/**
 * GET /api/transactions/stats
 * Get transaction statistics
 */
router.get(
  '/stats',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const stats = await transactionService.getTransactionStats({
      requestingUserId: req.user!.id,
      requestingUserRole: req.user!.role,
    });

    res.json({
      success: true,
      data: stats,
    });
  })
);

/**
 * GET /api/transactions/pending
 * Get pending returns
 */
router.get(
  '/pending',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const pendingReturns = await transactionService.getPendingReturns({
      requestingUserId: req.user!.id,
      requestingUserRole: req.user!.role,
    });

    res.json({
      success: true,
      data: pendingReturns,
    });
  })
);

/**
 * GET /api/transactions/pending-issues
 * Get pending issues (clothing items with PENDING status waiting for confirmation)
 */
router.get(
  '/pending-issues',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const pendingIssues = await transactionService.getPendingIssues({
      requestingUserId: req.user!.id,
      requestingUserRole: req.user!.role,
    });

    res.json({
      success: true,
      data: pendingIssues,
    });
  })
);

/**
 * GET /api/transactions/history/:clothingItemId
 * Get complete transaction history for a specific clothing item
 */
router.get(
  '/history/:clothingItemId',
  asyncHandler(async (req, res) => {
    const { clothingItemId } = req.params;

    const history = await prisma.transaction.findMany({
      where: { clothingItemId },
      include: {
        employee: true,
        clothingItem: {
          include: {
            type: true,
          },
        },
        issuedBy: true,
        returnedBy: true,
      },
      orderBy: { issuedAt: 'desc' },
    });

    res.json({
      success: true,
      data: history,
    });
  })
);

/**
 * GET /api/transactions/:id
 * Get single transaction by ID
 */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const transaction = await transactionService.getTransactionById(req.params.id);

    res.json({
      success: true,
      data: transaction,
    });
  })
);

/**
 * POST /api/transactions/bulk-issue
 * Issue multiple clothing items to employee (ADMIN, WAREHOUSE, HR)
 */
router.post(
  '/bulk-issue',
  authorize('ADMIN', 'WAREHOUSE', 'HR'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { employeeId, clothingItemIds, conditionOnIssue, notes } = req.body;

    if (!employeeId || !clothingItemIds || !Array.isArray(clothingItemIds) || clothingItemIds.length === 0 || !conditionOnIssue) {
      return res.status(400).json({
        success: false,
        error: 'employeeId, clothingItemIds (array), and conditionOnIssue are required',
      });
    }

    const transactions = await transactionService.issueBulkClothing({
      employeeId,
      clothingItemIds,
      issuedById: req.user!.id,
      conditionOnIssue,
      notes,
    });

    // Create email confirmation after successful bulk issue
    try {
      console.log('Starting email confirmation process...');
      
      // Get employee details
      const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        select: { firstName: true, lastName: true, email: true }
      });

      console.log('Employee found:', employee ? `${employee.firstName} ${employee.lastName} - ${employee.email}` : 'NOT FOUND');

      if (employee && employee.email) {
        console.log('Preparing items data for email...');
        
        // Prepare items data for email
        const itemsData = await Promise.all(
          clothingItemIds.map(async (itemId: string) => {
            const item = await prisma.clothingItem.findUnique({
              where: { id: itemId },
              include: { type: true }
            });

            // Build absolute image URL if available (uses ENV config)
            const assetBase = `https://${process.env.APP_HOST}:${process.env.FRONTEND_PORT}`;
            const relativeImageUrl = item?.imageUrl || item?.type.imageUrl || null;
            const imageUrl = relativeImageUrl ? `${assetBase}${relativeImageUrl}` : null;

            return {
              quantity: 1,
              name: item?.type.name || 'Unbekannter Artikel',
              size: item?.size || 'N/A',
              category: item?.type.category || 'N/A',
              imageUrl,
            };
          })
        );

        console.log('Items data prepared:', itemsData);

        // Generate confirmation token
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        console.log('Creating confirmation record with token:', token);

        // Create confirmation record
        const confirmation = await prisma.confirmation.create({
          data: {
            token,
            employeeId,
            protocolType: 'BULK_ISSUE',
            itemsJson: JSON.stringify({
              items: itemsData,
              transactionIds: transactions.map(t => t.id), // Store transaction IDs
            }),
            expiresAt,
          }
        });

        console.log('Confirmation record created with ID:', confirmation.id);

        // Send confirmation email with dynamic host from ENV
        const confirmationUrl = `https://${process.env.APP_HOST}:${process.env.FRONTEND_PORT}/confirm/${token}`;
        
        console.log('Sending confirmation email to:', employee.email);
        console.log('Confirmation URL:', confirmationUrl);
        
        const emailSent = await emailService.sendConfirmationEmail({
          employeeEmail: employee.email,
          employeeName: `${employee.firstName} ${employee.lastName}`,
          confirmationUrl,
          protocolType: 'BULK_ISSUE',
          items: itemsData,
          expiresAt,
        });

        console.log('Email sent result:', emailSent);

        // Update confirmation record with email status
        await prisma.confirmation.update({
          where: { id: confirmation.id },
          data: {
            emailSent,
            emailSentAt: emailSent ? new Date() : null,
            emailError: emailSent ? null : 'Failed to send email'
          }
        });

        console.log(`Email confirmation ${emailSent ? 'SUCCESSFULLY SENT' : 'FAILED'} for bulk issue to ${employee.email}`);
      } else {
        console.log('No employee email found, skipping email confirmation');
      }
    } catch (emailError) {
      console.error('Error in email confirmation process:', emailError);
      // Don't fail the transaction if email fails
    }

    res.status(201).json({
      success: true,
      data: transactions,
      message: `${transactions.length} Artikel erfolgreich ausgegeben`,
    });
  })
);

/**
 * POST /api/transactions/issue
 * Issue clothing to employee (ADMIN, WAREHOUSE, HR)
 */
router.post(
  '/issue',
  authorize('ADMIN', 'WAREHOUSE', 'HR'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { employeeId, clothingItemId, conditionOnIssue, notes } = req.body;

    if (!employeeId || !clothingItemId || !conditionOnIssue) {
      return res.status(400).json({
        success: false,
        error: 'employeeId, clothingItemId, and conditionOnIssue are required',
      });
    }

    const transaction = await transactionService.issueClothing({
      employeeId,
      clothingItemId,
      issuedById: req.user!.id,
      conditionOnIssue,
      notes,
    });

    // Create email confirmation after successful single issue
    try {
      console.log('Starting email confirmation process for single issue...');
      
      // Get employee details
      const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        select: { firstName: true, lastName: true, email: true }
      });

      if (employee && employee.email) {
        // Get item details
        const item = await prisma.clothingItem.findUnique({
          where: { id: clothingItemId },
          include: { type: true }
        });

        const itemsData = [{
          quantity: 1,
          name: item?.type.name || 'Unbekannter Artikel',
          size: item?.size || 'N/A',
          category: item?.type.category || 'N/A'
        }];

        // Generate confirmation token
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        // Create confirmation record
        const confirmation = await prisma.confirmation.create({
          data: {
            token,
            employeeId,
            protocolType: 'SINGLE',
            itemsJson: JSON.stringify({
              items: itemsData,
              transactionIds: [transaction.id],
            }),
            expiresAt,
          }
        });

        // Send confirmation email with dynamic host from ENV
        const confirmationUrl = `https://${process.env.APP_HOST}:${process.env.FRONTEND_PORT}/confirm/${token}`;
        
        const emailSent = await emailService.sendConfirmationEmail({
          employeeEmail: employee.email,
          employeeName: `${employee.firstName} ${employee.lastName}`,
          confirmationUrl,
          protocolType: 'SINGLE',
          items: itemsData,
          expiresAt,
        });

        // Update confirmation record with email status
        await prisma.confirmation.update({
          where: { id: confirmation.id },
          data: {
            emailSent,
            emailSentAt: emailSent ? new Date() : null,
            emailError: emailSent ? null : 'Failed to send email'
          }
        });

        console.log(`Email confirmation ${emailSent ? 'SUCCESSFULLY SENT' : 'FAILED'} for single issue to ${employee.email}`);
      }
    } catch (emailError) {
      console.error('Error in email confirmation process for single issue:', emailError);
    }

    res.status(201).json({
      success: true,
      data: transaction,
    });
  })
);

/**
 * POST /api/transactions/bulk-return-individual
 * Return multiple clothing items with individual condition assessment (ADMIN, WAREHOUSE, HR)
 */
router.post(
  '/bulk-return-individual',
  authorize('ADMIN', 'WAREHOUSE', 'HR'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { items, generalNotes } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'items array is required',
      });
    }

    // Validate each item
    for (const item of items) {
      if (!item.transactionId || !item.conditionOnReturn) {
        return res.status(400).json({
          success: false,
          error: 'Each item must have transactionId and conditionOnReturn',
        });
      }
    }

    const transactions = await transactionService.returnBulkClothingIndividual({
      items,
      returnedById: req.user!.id,
      generalNotes,
    });

    res.json({
      success: true,
      data: transactions,
      message: `${transactions.length} Artikel erfolgreich zurückgenommen`,
    });
  })
);

/**
 * POST /api/transactions/bulk-return
 * Return multiple clothing items from employee (ADMIN, WAREHOUSE, HR)
 */
router.post(
  '/bulk-return',
  authorize('ADMIN', 'WAREHOUSE', 'HR'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { transactionIds, conditionOnReturn, notes } = req.body;

    if (!transactionIds || !Array.isArray(transactionIds) || transactionIds.length === 0 || !conditionOnReturn) {
      return res.status(400).json({
        success: false,
        error: 'transactionIds (array) and conditionOnReturn are required',
      });
    }

    const transactions = await transactionService.returnBulkClothing({
      transactionIds,
      returnedById: req.user!.id,
      conditionOnReturn,
      notes,
    });

    res.json({
      success: true,
      data: transactions,
      message: `${transactions.length} Artikel erfolgreich zurückgenommen`,
    });
  })
);

/**
 * POST /api/transactions/:id/return
 * Return clothing from employee (ADMIN, WAREHOUSE, HR)
 */
router.post(
  '/:id/return',
  authorize('ADMIN', 'WAREHOUSE', 'HR'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { conditionOnReturn, notes } = req.body;

    if (!conditionOnReturn) {
      return res.status(400).json({
        success: false,
        error: 'conditionOnReturn is required',
      });
    }

    const transaction = await transactionService.returnClothing({
      transactionId: req.params.id,
      returnedById: req.user!.id,
      conditionOnReturn,
      notes,
    });

    res.json({
      success: true,
      data: transaction,
    });
  })
);

export default router;
