import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { pdfService } from '../services/pdf.service';
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);

/**
 * GET /api/reports/transaction/:id/protocol
 * Generate PDF protocol for transaction (issue or return)
 */
router.get(
  '/transaction/:id/protocol',
  asyncHandler(async (req, res) => {
    const { type } = req.query; // 'issue' or 'return'

    if (!type || (type !== 'issue' && type !== 'return')) {
      return res.status(400).json({
        success: false,
        error: 'Query parameter "type" must be either "issue" or "return"',
      });
    }

    // For issue protocols, check if confirmation exists and is confirmed
    if (type === 'issue') {
      const transaction = await prisma.transaction.findUnique({
        where: { id: req.params.id },
        include: { employee: true }
      });

      if (!transaction) {
        return res.status(404).json({
          success: false,
          error: 'Transaktion nicht gefunden',
        });
      }

      // Check if there's a confirmed confirmation for this transaction
      const confirmation = await prisma.confirmation.findFirst({
        where: {
          employeeId: transaction.employeeId,
          confirmed: true,
          itemsJson: {
            contains: req.params.id // Check if this transaction ID is in the JSON
          }
        }
      });

      if (!confirmation) {
        return res.status(403).json({
          success: false,
          error: 'Ausgabeprotokoll kann erst nach bestätigtem Erhalt durch den Mitarbeiter erstellt werden',
        });
      }

      // Check if we have a stored protocol file
      if (confirmation.protocolFilePath) {
        const filePath = path.join(__dirname, '../../', confirmation.protocolFilePath);
        
        // Check if file exists on disk
        if (fs.existsSync(filePath)) {
          console.log('Serving stored protocol file:', confirmation.protocolFilePath);
          
          const filename = `${type === 'issue' ? 'Ausgabe' : 'Ruecknahme'}-${req.params.id}.pdf`;
          
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
          
          // Stream the file
          const fileStream = fs.createReadStream(filePath);
          fileStream.pipe(res);
          return;
        } else {
          console.warn('Stored protocol file not found on disk, falling back to dynamic generation:', confirmation.protocolFilePath);
        }
      }
    }

    // Fallback: Generate PDF dynamically (for return protocols or missing stored files)
    console.log('Generating protocol dynamically for transaction:', req.params.id);
    const pdfBuffer = await pdfService.generateTransactionProtocol({
      transactionId: req.params.id,
      type: type as 'issue' | 'return',
    });

    const filename = `${type === 'issue' ? 'Ausgabe' : 'Ruecknahme'}-${req.params.id}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  })
);

/**
 * GET /api/reports/bulk-issue
 * Generate PDF protocol for bulk issue (multiple items)
 */
router.get(
  '/bulk-issue',
  asyncHandler(async (req, res) => {
    const { transactionIds, skipConfirmationCheck } = req.query;

    if (!transactionIds || typeof transactionIds !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Query parameter "transactionIds" (comma-separated) is required',
      });
    }

    const ids = transactionIds.split(',');

    // Only check confirmations if skipConfirmationCheck is not set (for later downloads)
    let storedProtocolPath = null;
    if (skipConfirmationCheck !== 'true') {
      for (const transactionId of ids) {
        const transaction = await prisma.transaction.findUnique({
          where: { id: transactionId },
          include: { employee: true }
        });

        if (!transaction) {
          return res.status(404).json({
            success: false,
            error: `Transaktion ${transactionId} nicht gefunden`,
          });
        }

        // Check if there's a confirmed confirmation that includes this transaction
        const confirmation = await prisma.confirmation.findFirst({
          where: {
            employeeId: transaction.employeeId,
            confirmed: true,
            itemsJson: {
              contains: transactionId // Check if transaction ID is in the JSON
            }
          }
        });

        if (!confirmation) {
          return res.status(403).json({
            success: false,
            error: `Ausgabeprotokoll kann erst nach bestätigtem Erhalt durch ${transaction.employee.firstName} ${transaction.employee.lastName} erstellt werden`,
          });
        }

        // Check if this confirmation has a stored protocol file (for first transaction)
        if (!storedProtocolPath && confirmation.protocolFilePath && confirmation.protocolType === 'BULK_ISSUE') {
          storedProtocolPath = confirmation.protocolFilePath;
        }
      }

      // Check if we have a stored bulk protocol file
      if (storedProtocolPath) {
        const filePath = path.join(__dirname, '../../', storedProtocolPath);
        
        // Check if file exists on disk
        if (fs.existsSync(filePath)) {
          console.log('Serving stored bulk protocol file:', storedProtocolPath);
          
          const filename = `Ausgabeprotokoll-${new Date().toISOString().split('T')[0]}.pdf`;
          
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
          
          // Stream the file
          const fileStream = fs.createReadStream(filePath);
          fileStream.pipe(res);
          return;
        } else {
          console.warn('Stored bulk protocol file not found on disk, falling back to dynamic generation:', storedProtocolPath);
        }
      }
    }

    // Fallback: Generate PDF dynamically (for fresh issues or missing stored files)
    console.log('Generating bulk protocol dynamically for transactions:', ids);
    const pdfBuffer = await pdfService.generateBulkIssueProtocol({
      transactionIds: ids,
    });

    const filename = `Ausgabeprotokoll-${new Date().toISOString().split('T')[0]}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  })
);

/**
 * GET /api/reports/bulk-return
 * Generate PDF protocol for bulk return (multiple items)
 */
router.get(
  '/bulk-return',
  asyncHandler(async (req, res) => {
    const { transactionIds } = req.query;

    if (!transactionIds || typeof transactionIds !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Query parameter "transactionIds" (comma-separated) is required',
      });
    }

    const ids = transactionIds.split(',');

    const pdfBuffer = await pdfService.generateBulkReturnProtocol({
      transactionIds: ids,
    });

    const filename = `Ruecknahmeprotokoll-${new Date().toISOString().split('T')[0]}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  })
);

/**
 * GET /api/reports/inventory
 * Generate inventory report PDF
 */
router.get(
  '/inventory',
  asyncHandler(async (req, res) => {
    const { status, category } = req.query;

    const pdfBuffer = await pdfService.generateInventoryReport({
      status: status as string,
      category: category as string,
    });

    const filename = `Inventarbericht-${new Date().toISOString().split('T')[0]}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  })
);

/**
 * GET /api/reports/dashboard
 * Get dashboard statistics (placeholder for future use)
 */
router.get('/dashboard', asyncHandler(async (req, res) => {
  res.json({ success: true, data: {} });
}));

export default router;
