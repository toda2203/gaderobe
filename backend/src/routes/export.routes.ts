import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { exportService } from '../services/export.service';
import { uploadZip } from '../middleware/upload';
import prisma from '../utils/database';

const router = Router();

router.use(authenticate);

/**
 * GET /api/export/backup
 * Export all data to ZIP file with CSV files
 */
router.get(
  '/backup',
  authorize('ADMIN', 'HR'),
  asyncHandler(async (req, res) => {
    const buffer = await exportService.exportToCSVZip();

    const filename = `bekleidung-backup-${new Date().toISOString().split('T')[0]}.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  })
);

/**
 * POST /api/export/import
 * Import data from ZIP file with CSV files
 */
router.post(
  '/import',
  (req, res, next) => {
    console.log('Import middleware - checking auth and file:', {
      headers: req.headers,
      contentType: req.headers['content-type'],
    });
    next();
  },
  authorize('ADMIN'),
  uploadZip.single('file'),
  asyncHandler(async (req, res) => {
    console.log('Import request received:', {
      file: req.file ? { name: req.file.originalname, size: req.file.size, mimetype: req.file.mimetype } : null,
      hasFile: !!req.file,
      headers: req.headers,
    });

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Keine Datei hochgeladen',
        details: 'req.file ist leer',
        contentType: req.headers['content-type'],
      });
    }

    try {
      const result = await exportService.importFromCSVZip(req.file.buffer);

      // Validate images after successful import
      const fs = require('fs');
      const path = require('path');
      const uploadsDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
      
      // Get all images and check them
      const clothingTypeImages = await prisma.clothingType.findMany({
        where: { imageUrl: { not: null } },
        select: { id: true, imageUrl: true },
      });

      const clothingItemImages = await prisma.clothingItem.findMany({
        where: { imageUrl: { not: null } },
        select: { id: true, imageUrl: true },
      });

      const allImages = [...clothingTypeImages, ...clothingItemImages];
      const imageValidation = {
        total: allImages.length,
        found: 0,
        missing: 0,
      };

      allImages.forEach(img => {
        const localPath = img.imageUrl.replace(/^\//, '');
        const fullPath = path.join(uploadsDir, localPath);
        if (fs.existsSync(fullPath)) {
          imageValidation.found++;
        } else {
          imageValidation.missing++;
        }
      });

      res.json({
        success: result.success,
        data: result.imported,
        errors: result.errors,
        imageValidation,
        message: `Import abgeschlossen: ${result.imported.employees} Mitarbeiter, ${result.imported.clothingTypes} Typen, ${result.imported.clothingItems} Kleidungsstücke, ${result.imported.transactions} Transaktionen. Bilder: ${imageValidation.found}/${imageValidation.total} gefunden.`,
      });
    } catch (error: any) {
      console.error('Import error in route:', error);
      throw error;
    }
  })
);

/**
 * GET /api/export/stats
 * Get database statistics for export
 * Available for all authenticated users
 */
router.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const [
      employeesCount,
      typesCount,
      itemsCount,
      transactionsCount,
      auditLogsCount,
    ] = await Promise.all([
      prisma.employee.count(),
      prisma.clothingType.count(),
      prisma.clothingItem.count(),
      prisma.transaction.count(),
      prisma.auditLog.count(),
    ]);

    res.json({
      success: true,
      data: {
        employees: employeesCount,
        clothingTypes: typesCount,
        clothingItems: itemsCount,
        transactions: transactionsCount,
        auditLogs: auditLogsCount,
        totalRecords:
          employeesCount +
          typesCount +
          itemsCount +
          transactionsCount +
          auditLogsCount,
      },
    });
  })
);

/**
 * GET /api/export/validate-images
 * Validate and repair image references after restore
 * Returns report of missing/found images
 */
router.get(
  '/validate-images',
  authorize('ADMIN'),
  asyncHandler(async (req, res) => {
    const fs = require('fs');
    const path = require('path');

    const uploadsDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
    const clothingImagesDir = path.join(uploadsDir, 'clothing-images');

    // Ensure directory exists
    if (!fs.existsSync(clothingImagesDir)) {
      fs.mkdirSync(clothingImagesDir, { recursive: true });
    }

    // Get all images referenced in database
    const clothingTypeImages = await prisma.clothingType.findMany({
      where: { imageUrl: { not: null } },
      select: { id: true, name: true, imageUrl: true },
    });

    const clothingItemImages = await prisma.clothingItem.findMany({
      where: { imageUrl: { not: null } },
      select: { id: true, internalId: true, imageUrl: true },
    });

    const allDbImages = [
      ...clothingTypeImages.map(ct => ({ type: 'clothingType', name: ct.name, url: ct.imageUrl })),
      ...clothingItemImages.map(ci => ({ type: 'clothingItem', name: ci.internalId, url: ci.imageUrl })),
    ];

    // Check which files exist
    const validation = allDbImages.map(img => {
      const localPath = img.url.replace(/^\//, '');
      const fullPath = path.join(uploadsDir, localPath);
      const exists = fs.existsSync(fullPath);

      return {
        name: img.name,
        type: img.type,
        url: img.url,
        exists,
        filename: path.basename(img.url),
      };
    });

    const found = validation.filter(v => v.exists);
    const missing = validation.filter(v => !v.exists);

    // Get actual files in filesystem
    const getFilesRecursive = (dir) => {
      let files = [];
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        entries.forEach(entry => {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            files = [...files, ...getFilesRecursive(fullPath)];
          } else {
            files.push(path.relative(uploadsDir, fullPath));
          }
        });
      } catch (e) {
        console.error(`Error reading dir ${dir}:`, e);
      }
      return files;
    };

    const filesInSystem = getFilesRecursive(uploadsDir);
    const orphaned = filesInSystem.filter(file => {
      return !allDbImages.some(img => img.url.includes(path.basename(file)));
    });

    res.json({
      success: true,
      data: {
        summary: {
          total: allDbImages.length,
          found: found.length,
          missing: missing.length,
          orphaned: orphaned.length,
        },
        found: found.map(f => ({ ...f, status: 'OK' })),
        missing: missing.map(m => ({ ...m, status: 'MISSING', suggestedPath: `/uploads/clothing-images/${m.filename}` })),
        orphaned: orphaned,
      },
    });
  })
);

export default router;
