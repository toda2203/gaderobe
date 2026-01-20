import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { clothingTypeService } from '../services/clothing-type.service';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/clothing-types
 * Get all clothing types with optional filtering
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { category, isActive } = req.query;
    const filters = {
      category: category as string,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    };

    const clothingTypes = await clothingTypeService.getAllClothingTypes(filters);

    res.json({
      success: true,
      data: clothingTypes,
    });
  })
);

/**
 * GET /api/clothing-types/stats
 * Get clothing type statistics
 */
router.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const stats = await clothingTypeService.getClothingTypeStats();

    res.json({
      success: true,
      data: stats,
    });
  })
);

/**
 * GET /api/clothing-types/:id
 * Get single clothing type by ID
 */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const clothingType = await clothingTypeService.getClothingTypeById(req.params.id);

    res.json({
      success: true,
      data: clothingType,
    });
  })
);

/**
 * POST /api/clothing-types
 * Create new clothing type (ADMIN, WAREHOUSE, HR)
 */
router.post(
  '/',
  authorize('ADMIN', 'WAREHOUSE', 'HR'),
  asyncHandler(async (req, res) => {
    const { name, description, category, availableSizes, expectedLifespanMonths, requiresDepartment, imageUrl } = req.body;

    if (!name || !category || !availableSizes || !Array.isArray(availableSizes)) {
      return res.status(400).json({
        success: false,
        error: 'name, category, and availableSizes (array) are required',
      });
    }

    const clothingType = await clothingTypeService.createClothingType({
      name,
      description,
      category,
      availableSizes,
      expectedLifespanMonths,
      requiresDepartment,
      imageUrl,
    });

    res.status(201).json({
      success: true,
      data: clothingType,
    });
  })
);

/**
 * PATCH /api/clothing-types/:id
 * Update clothing type (ADMIN, WAREHOUSE, HR)
 */
router.patch(
  '/:id',
  authorize('ADMIN', 'WAREHOUSE', 'HR'),
  asyncHandler(async (req, res) => {
    const clothingType = await clothingTypeService.updateClothingType(req.params.id, req.body);

    res.json({
      success: true,
      data: clothingType,
    });
  })
);

/**
 * DELETE /api/clothing-types/:id
 * Soft delete clothing type (ADMIN, WAREHOUSE, HR)
 */
router.delete(
  '/:id',
  authorize('ADMIN', 'WAREHOUSE', 'HR'),
  asyncHandler(async (req, res) => {
    const clothingType = await clothingTypeService.deleteClothingType(req.params.id);

    res.json({
      success: true,
      data: clothingType,
      message: 'Clothing type deactivated',
    });
  })
);

/**
 * DELETE /api/clothing-types/:id/permanent
 * Permanently delete inactive clothing type (ADMIN only)
 */
router.delete(
  '/:id/permanent',
  authorize('ADMIN'),
  asyncHandler(async (req, res) => {
    const clothingType = await clothingTypeService.permanentlyDeleteClothingType(req.params.id);

    res.json({
      success: true,
      data: clothingType,
      message: 'Kleidungstyp wurde dauerhaft gelöscht',
    });
  })
);

export default router;
