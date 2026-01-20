import { Router } from 'express';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.middleware';
import { EmailService } from '../services/email.service';
import { pdfService } from '../services/pdf.service';
import * as fs from 'fs';
import * as path from 'path';

const router = Router();
const prisma = new PrismaClient();
const emailService = new EmailService();

// ========================================
// Create confirmation link
// POST /confirmations
// ========================================
router.post('/', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const {
      employeeId,
      transactionId,
      protocolId,
      protocolType,
      itemsJson,
    } = req.body;

    // Validate required fields
    if (!employeeId || !protocolType || !itemsJson) {
      return res.status(400).json({
        error: 'Missing required fields: employeeId, protocolType, itemsJson',
      });
    }

    // Check if employee exists
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Generate unique token
    const token = crypto.randomBytes(32).toString('hex');

    // Set expiration (7 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Create confirmation record
    const confirmation = await prisma.confirmation.create({
      data: {
        token,
        employeeId,
        transactionId,
        protocolId,
        protocolType,
        itemsJson,
        expiresAt,
      },
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    res.json({
      success: true,
      message: 'Confirmation link created',
      data: {
        confirmationId: confirmation.id,
        token: confirmation.token,
        employeeEmail: confirmation.employee.email,
        employeeName: `${confirmation.employee.firstName} ${confirmation.employee.lastName}`,
        expiresAt: confirmation.expiresAt,
        confirmationUrl: `${req.protocol}://${req.hostname}:3078/confirm/${token}`,
      },
    });
  } catch (error: any) {
    console.error('Error creating confirmation:', error);
    res.status(500).json({
      error: 'Failed to create confirmation link',
      details: error.message,
    });
  }
});

// ========================================
// Get confirmation details
// GET /confirmations/:token
// ========================================
router.get('/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const confirmation = await prisma.confirmation.findUnique({
      where: { token },
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            entraId: true,
          },
        },
      },
    });

    if (!confirmation) {
      return res.status(404).json({ error: 'Confirmation not found' });
    }

    // Check if expired
    if (confirmation.expiresAt < new Date()) {
      return res.status(410).json({ error: 'Confirmation link has expired' });
    }

    // Parse items JSON
    let items;
    let transactionIds;
    try {
      const parsedJson = JSON.parse(confirmation.itemsJson);
      // Handle both old format (direct array) and new format (object with items/transactionIds)
      if (Array.isArray(parsedJson)) {
        items = parsedJson;
        transactionIds = [];
      } else {
        items = parsedJson.items || [];
        transactionIds = parsedJson.transactionIds || [];
      }
    } catch (e) {
      items = [];
      transactionIds = [];
    }

    res.json({
      success: true,
      data: {
        id: confirmation.id,
        protocolType: confirmation.protocolType,
        items,
        employee: {
          name: `${confirmation.employee.firstName} ${confirmation.employee.lastName}`,
          email: confirmation.employee.email,
        },
        confirmed: confirmation.confirmed,
        confirmedAt: confirmation.confirmedAt,
        confirmedBy: confirmation.confirmedBy,
        expiresAt: confirmation.expiresAt,
        createdAt: confirmation.createdAt,
      },
    });
  } catch (error: any) {
    console.error('Error fetching confirmation:', error);
    res.status(500).json({
      error: 'Failed to fetch confirmation',
      details: error.message,
    });
  }
});

// ========================================
// Confirm receipt
// POST /confirmations/:token/confirm
// ========================================
router.post('/:token/confirm', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { token } = req.params;
    const user = req.user; // From authentication middleware

    console.log('Confirming receipt for token:', token);
    console.log('User confirming:', user?.entraId);

    const confirmation = await prisma.confirmation.findUnique({
      where: { token },
      include: {
        employee: {
          select: {
            entraId: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!confirmation) {
      console.log('Confirmation not found for token:', token);
      return res.status(404).json({ error: 'Confirmation not found' });
    }

    // Check if expired
    if (confirmation.expiresAt < new Date()) {
      console.log('Confirmation expired');
      return res.status(410).json({ error: 'Confirmation link has expired' });
    }

    // Check if already confirmed
    if (confirmation.confirmed) {
      console.log('Confirmation already completed');
      return res.status(400).json({
        error: 'Already confirmed',
        confirmedAt: confirmation.confirmedAt,
        confirmedBy: confirmation.confirmedBy,
      });
    }

    // Verify that the logged-in user matches the employee
    console.log('Confirmation validation:');
    console.log('User entraId (from token):', user.entraId);
    console.log('Employee entraId:', confirmation.employee.entraId);
    console.log('User object:', JSON.stringify(user, null, 2));
    
    if (user.entraId !== confirmation.employee.entraId) {
      return res.status(403).json({
        error: 'Sie können nur Ihre eigenen Bestätigungen durchführen',
      });
    }

    console.log('Updating confirmation...');

    console.log('Updating confirmation...');
    
    // Update confirmation
    const updatedConfirmation = await prisma.confirmation.update({
      where: { id: confirmation.id },
      data: {
        confirmed: true,
        confirmedAt: new Date(),
        confirmedBy: user.entraId, // Microsoft User ID
        ipAddress: req.ip || req.socket?.remoteAddress || 'unknown',
        userAgent: req.get('User-Agent'),
      },
    });

    console.log('Confirmation updated successfully');

    // Update clothing items status from PENDING to ISSUED
    try {
      console.log('Updating clothing item statuses...');
      const confirmationData = JSON.parse(confirmation.itemsJson);
      const transactionIds = Array.isArray(confirmationData) ? [] : (confirmationData.transactionIds || []);
      
      if (transactionIds.length > 0) {
        // Get all transactions and their clothing items
        const transactions = await prisma.transaction.findMany({
          where: { id: { in: transactionIds } },
          include: { clothingItem: true }
        });
        
        // Update clothing item statuses from PENDING to ISSUED
        // Make sure to preserve currentEmployeeId
        for (const transaction of transactions) {
          await prisma.clothingItem.update({
            where: { 
              id: transaction.clothingItemId,
              status: 'PENDING' // Only update items that are currently PENDING
            },
            data: { 
              status: 'ISSUED',
              // Ensure currentEmployeeId is set to the transaction's employee
              currentEmployeeId: transaction.employeeId
            }
          });
        }

        console.log(`Updated ${transactions.length} clothing items from PENDING to ISSUED after confirmation`);
      }
    } catch (error) {
      console.error('Error updating clothing item statuses:', error);
      // Don't fail the confirmation if status update fails
    }

    console.log('Creating audit log...');
    
    // Create audit log (simplified without employeeId if not supported)
    try {
      await prisma.auditLog.create({
        data: {
          action: 'RECEIPT_CONFIRMED',
          entityType: 'CONFIRMATION',
          entityId: confirmation.id,
          changes: JSON.stringify({
            protocolType: confirmation.protocolType,
            confirmedBy: user.entraId,
            confirmedAt: updatedConfirmation.confirmedAt,
            ipAddress: updatedConfirmation.ipAddress,
          }),
          performedBy: user.entraId,
          timestamp: new Date(),
          ipAddress: req.ip || req.socket?.remoteAddress || 'unknown',
          userAgent: req.get('User-Agent'),
        },
      });
      console.log('Audit log created successfully');
    } catch (auditError) {
      console.error('Error creating audit log (non-critical):', auditError);
      // Don't fail the confirmation if audit log fails
    }

    // Generate and save PDF protocol after successful confirmation
    let protocolFilePath = null;
    try {
      console.log('Generating PDF protocol...');
      
      const confirmationData = JSON.parse(confirmation.itemsJson);
      
      if (confirmation.protocolType === 'SINGLE' && confirmation.transactionId) {
        // Single transaction protocol
        const pdfBuffer = await pdfService.generateTransactionProtocol({
          transactionId: confirmation.transactionId,
          type: 'issue',
        });
        
        // Create filename and save path
        const filename = `protocol-issue-${confirmation.transactionId}-${Date.now()}.pdf`;
        const uploadsDir = path.join(__dirname, '../../uploads/protocols');
        
        // Ensure directory exists
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }
        
        const filePath = path.join(uploadsDir, filename);
        
        // Save PDF to disk
        fs.writeFileSync(filePath, pdfBuffer);
        protocolFilePath = `uploads/protocols/${filename}`;
        
        console.log('PDF protocol saved:', protocolFilePath);
        
      } else if (confirmation.protocolType === 'BULK_ISSUE' && Array.isArray(confirmationData.transactionIds)) {
        // Bulk issue protocol
        const pdfBuffer = await pdfService.generateBulkIssueProtocol({
          transactionIds: confirmationData.transactionIds,
        });
        
        // Create filename and save path
        const filename = `protocol-bulk-issue-${confirmation.protocolId || confirmation.id}-${Date.now()}.pdf`;
        const uploadsDir = path.join(__dirname, '../../uploads/protocols');
        
        // Ensure directory exists
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }
        
        const filePath = path.join(uploadsDir, filename);
        
        // Save PDF to disk
        fs.writeFileSync(filePath, pdfBuffer);
        protocolFilePath = `uploads/protocols/${filename}`;
        
        console.log('Bulk PDF protocol saved:', protocolFilePath);
      }
      
      // Update confirmation with protocol file path
      if (protocolFilePath) {
        await prisma.confirmation.update({
          where: { id: confirmation.id },
          data: { protocolFilePath }
        });
        console.log('Protocol file path saved to confirmation');
      }
      
    } catch (pdfError) {
      console.error('Error generating/saving PDF protocol (non-critical):', pdfError);
      // Don't fail the confirmation if PDF generation fails
    }

    res.json({
      success: true,
      message: 'Receipt confirmed successfully',
      data: {
        confirmedAt: updatedConfirmation.confirmedAt,
        confirmedBy: updatedConfirmation.confirmedBy,
        employee: {
          name: `${confirmation.employee.firstName} ${confirmation.employee.lastName}`,
        },
      },
    });
  } catch (error: any) {
    console.error('Error confirming receipt:', error);
    res.status(500).json({
      error: 'Failed to confirm receipt',
      details: error.message,
    });
  }
});

// ========================================
// List confirmations (Admin only)
// GET /confirmations
// ========================================
router.get('/', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user;

    // Check if user is admin
    const employee = await prisma.employee.findUnique({
      where: { entraId: user.sub },
      select: { role: true },
    });

    if (!employee || employee.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const confirmations = await prisma.confirmation.findMany({
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100, // Limit to last 100
    });

    res.json({
      success: true,
      data: confirmations.map((conf) => ({
        id: conf.id,
        protocolType: conf.protocolType,
        employee: {
          name: `${conf.employee.firstName} ${conf.employee.lastName}`,
          email: conf.employee.email,
        },
        confirmed: conf.confirmed,
        confirmedAt: conf.confirmedAt,
        emailSent: conf.emailSent,
        emailSentAt: conf.emailSentAt,
        expiresAt: conf.expiresAt,
        createdAt: conf.createdAt,
      })),
    });
  } catch (error: any) {
    console.error('Error fetching confirmations:', error);
    res.status(500).json({
      error: 'Failed to fetch confirmations',
      details: error.message,
    });
  }
});

// ========================================
// Resend confirmation email
// POST /confirmations/resend/:transactionId
// ========================================
router.post('/resend/:transactionId', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { transactionId } = req.params;
    console.log(`Attempting to resend confirmation for transaction: ${transactionId}`);
    
    // Find confirmation by checking if transactionId is in itemsJson
    const confirmation = await prisma.confirmation.findFirst({
      where: {
        OR: [
          { transactionId }, // Direct transaction ID match (if exists)
          {
            itemsJson: {
              contains: transactionId // Check if transaction ID is in the JSON
            }
          }
        ]
      },
      include: {
        employee: true,
      },
    });

    console.log(`Confirmation found: ${!!confirmation}`);
    
    if (!confirmation) {
      console.log('No confirmation found for transaction:', transactionId);
      return res.status(404).json({ error: 'Confirmation not found for this transaction' });
    }

    if (confirmation.confirmed) {
      console.log('Confirmation already completed');
      return res.status(400).json({ error: 'Confirmation already completed' });
    }

    console.log('Sending confirmation email to:', confirmation.employee.email);

    // Parse items from confirmation JSON
    let items = [];
    try {
      const itemsData = JSON.parse(confirmation.itemsJson);
      items = itemsData.items || [];
    } catch (error) {
      console.error('Error parsing items JSON:', error);
      items = [{ quantity: 1, name: 'Kleidungsstück', size: 'N/A' }];
    }

    // Resend email
    await emailService.sendConfirmationEmail({
      employeeEmail: confirmation.employee.email,
      employeeName: `${confirmation.employee.firstName} ${confirmation.employee.lastName}`,
      confirmationUrl: `${req.protocol}://${req.hostname}:3078/confirm/${confirmation.token}`,
      protocolType: confirmation.protocolType,
      items: items,
      expiresAt: confirmation.expiresAt,
    });    // Update email sent timestamp
    await prisma.confirmation.update({
      where: { id: confirmation.id },
      data: {
        emailSent: true,
        emailSentAt: new Date(),
      },
    });

    res.json({
      success: true,
      message: 'Confirmation email resent successfully',
    });
  } catch (error: any) {
    console.error('Error resending confirmation email:', error);
    res.status(500).json({
      error: 'Failed to resend confirmation email',
      details: error.message,
    });
  }
});

export default router;