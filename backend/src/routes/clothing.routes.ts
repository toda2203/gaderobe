import { Router } from 'express';
import { authenticate, authorize, AuthenticatedRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { clothingItemService } from '../services/clothing-item.service';
import { upload, deleteImage } from '../middleware/upload';
import * as fs from 'fs';
import * as path from 'path';

const router = Router();

router.use(authenticate);

/**
 * GET /api/clothing/items
 * Get all clothing items with optional filtering
 */
router.get(
  '/items',
  asyncHandler(async (req: any, res) => {
    const { typeId, category, status, personalizedForId } = req.query;
    const filters = {
      typeId: typeId as string,
      category: category as string,
      status: status as string,
      personalizedForId: personalizedForId as string,
      requestingUserId: req.user.id, // Pass current user ID
      requestingUserRole: req.user.role, // Pass current user role
    };

    const items = await clothingItemService.getAllClothingItems(filters);

    res.json({
      success: true,
      data: items,
    });
  })
);

/**
 * GET /api/clothing/items/stats
 * Get clothing item statistics
 */
router.get(
  '/items/stats',
  asyncHandler(async (req, res) => {
    const stats = await clothingItemService.getClothingItemStats();

    res.json({
      success: true,
      data: stats,
    });
  })
);

/**
 * GET /api/clothing/items/:id
 * Get single clothing item by ID
 */
router.get(
  '/items/:id',
  asyncHandler(async (req, res) => {
    const item = await clothingItemService.getClothingItemById(req.params.id);

    res.json({
      success: true,
      data: item,
    });
  })
);

/**
 * GET /api/clothing/items/:id/audit-log
 * Get audit log for a specific clothing item
 */
router.get(
  '/items/:id/audit-log',
  asyncHandler(async (req, res) => {
    try {
      const auditLogs = await clothingItemService.getClothingItemAuditLog(req.params.id);

      res.json({
        success: true,
        data: auditLogs,
      });
    } catch (error: any) {
      console.error('Audit log error:', error);
      
      // If table doesn't exist, return empty array
      if (error.message?.includes('Table') && error.message?.includes('audit_logs')) {
        console.log('Audit logs table not found, returning empty array');
        res.json({
          success: true,
          data: [],
          message: 'Audit logs table not yet created'
        });
      } else {
        throw error;
      }
    }
  })
);

/**
 * GET /api/clothing/qr/:qrCode
 * Get clothing item by QR code
 */
router.get(
  '/qr/:qrCode',
  asyncHandler(async (req, res) => {
    const item = await clothingItemService.getClothingItemByQRCode(req.params.qrCode);

    res.json({
      success: true,
      data: item,
    });
  })
);

/**
 * POST /api/clothing/items/upload-image
 * Upload image for clothing item (ADMIN, WAREHOUSE, HR)
 */
router.post(
  '/items/upload-image',
  authorize('ADMIN', 'WAREHOUSE', 'HR'),
  upload.single('image'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Kein Bild hochgeladen',
      });
    }

    // Return full URL that works with frontend proxy
    const imageUrl = `/uploads/clothing-images/${req.file.filename}`;

    res.status(201).json({
      success: true,
      data: { imageUrl },
      message: 'Bild erfolgreich hochgeladen',
    });
  })
);

/**
 * POST /api/clothing/upload-company-logo
 * Upload company logo for PDFs (ADMIN)
 */
router.post(
  '/upload-company-logo',
  authorize('ADMIN'),
  upload.single('logo'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Kein Logo hochgeladen',
      });
    }

    const uploadsDir = path.join(process.cwd(), 'uploads', 'clothing-images');
    const logoExtension = path.extname(req.file.originalname);
    const logoFileName = `company-logo${logoExtension}`;
    const logoPath = path.join(uploadsDir, logoFileName);

    // Remove existing company logo if it exists
    const existingLogos = fs.readdirSync(uploadsDir).filter(file => 
      file.startsWith('company-logo.'));
    existingLogos.forEach(logo => {
      try {
        fs.unlinkSync(path.join(uploadsDir, logo));
      } catch (error) {
        console.error('Error removing old logo:', error);
      }
    });

    // Move uploaded file to company logo name
    fs.renameSync(req.file.path, logoPath);

    const logoUrl = `/uploads/clothing-images/${logoFileName}`;

    res.status(201).json({
      success: true,
      data: { imageUrl: logoUrl },
      message: 'Firmenlogo erfolgreich hochgeladen',
    });
  })
);

/**
 * DELETE /api/clothing/items/delete-image
 * Delete clothing image (ADMIN, WAREHOUSE, HR)
 */
router.delete(
  '/items/delete-image',
  authorize('ADMIN', 'WAREHOUSE', 'HR'),
  asyncHandler(async (req, res) => {
    const { imageUrl } = req.body;

    if (!imageUrl) {
      return res.status(400).json({
        success: false,
        error: 'imageUrl is required',
      });
    }

    deleteImage(imageUrl);

    res.json({
      success: true,
      message: 'Bild erfolgreich gelöscht',
    });
  })
);

/**
 * POST /api/clothing/items/bulk
 * Bulk create multiple clothing items (ADMIN, WAREHOUSE, HR)
 */
router.post(
  '/items/bulk',
  authorize('ADMIN', 'WAREHOUSE', 'HR'),
  asyncHandler(async (req, res) => {
    const {
      typeId,
      size,
      category,
      condition,
      quantity,
      purchaseDate,
      purchasePrice,
      imageUrl,
    } = req.body;

    if (!typeId || !size || !category || !quantity) {
      return res.status(400).json({
        success: false,
        error: 'typeId, size, category, and quantity are required',
      });
    }

    if (quantity < 1 || quantity > 100) {
      return res.status(400).json({
        success: false,
        error: 'Quantity must be between 1 and 100',
      });
    }

    const items = await clothingItemService.bulkCreateClothingItems({
      typeId,
      size,
      category,
      condition,
      quantity,
      purchaseDate: purchaseDate ? new Date(purchaseDate) : undefined,
      purchasePrice,
      imageUrl,
    }, (req as AuthenticatedRequest).user!.id);

    res.status(201).json({
      success: true,
      data: items,
      message: `${items.length} Artikel erfolgreich erstellt`,
    });
  })
);

/**
 * POST /api/clothing/items
 * Create new clothing item (ADMIN, WAREHOUSE, HR)
 */
router.post(
  '/items',
  authorize('ADMIN', 'WAREHOUSE', 'HR'),
  asyncHandler(async (req, res) => {
    const {
      typeId,
      size,
      category,
      condition,
      personalizedForId,
      purchaseDate,
      purchasePrice,
      imageUrl,
    } = req.body;

    if (!typeId || !size || !category) {
      return res.status(400).json({
        success: false,
        error: 'typeId, size, and category are required',
      });
    }

    const item = await clothingItemService.createClothingItem({
      typeId,
      size,
      category,
      condition,
      personalizedForId,
      purchaseDate: purchaseDate ? new Date(purchaseDate) : undefined,
      purchasePrice,
      imageUrl,
    }, (req as AuthenticatedRequest).user!.id);

    res.status(201).json({
      success: true,
      data: item,
    });
  })
);

/**
 * PATCH /api/clothing/items/:id
 * Update clothing item (ADMIN, WAREHOUSE, HR)
 */
router.patch(
  '/items/:id',
  authorize('ADMIN', 'WAREHOUSE', 'HR'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const item = await clothingItemService.updateClothingItem(
      req.params.id, 
      req.body, 
      req.user!.id
    );

    res.json({
      success: true,
      data: item,
    });
  })
);

/**
 * DELETE /api/clothing/items/:id
 * Soft delete clothing item (ADMIN, WAREHOUSE, HR)
 */
router.delete(
  '/items/:id',
  authorize('ADMIN', 'WAREHOUSE', 'HR'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { reason } = req.body;
    const item = await clothingItemService.deleteClothingItem(
      req.params.id, 
      reason, 
      req.user!.id
    );

    res.json({
      success: true,
      data: item,
      message: 'Clothing item retired',
    });
  })
);

/**
 * DELETE /api/clothing/items/:id/permanent
 * Permanently delete retired clothing item (ADMIN only)
 */
router.delete(
  '/items/:id/permanent',
  authorize('ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    try {
      const item = await clothingItemService.permanentlyDeleteClothingItem(
        req.params.id,
        req.user!.id
      );

      res.json({
        success: true,
        data: item,
        message: 'Kleidungsstück wurde dauerhaft gelöscht',
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message || 'Fehler beim dauerhaften Löschen',
      });
    }
  })
);

export default router;
