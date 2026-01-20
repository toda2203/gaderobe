import { Router } from 'express';
import { asyncHandler } from '../middleware/error.middleware';
import { masterDataService } from '../services/master-data.service';

const router = Router();

/**
 * GET /api/public/master-data/:type
 * Get all master data items of a type, sorted by order
 * PUBLIC - no authentication required
 */
router.get(
  '/master-data/:type',
  asyncHandler(async (req, res) => {
    const { type } = req.params;

    if (!['SIZE', 'CATEGORY', 'DEPARTMENT'].includes(type.toUpperCase())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid type. Must be SIZE, CATEGORY, or DEPARTMENT',
      });
    }

    const items = await masterDataService.getByType(type.toUpperCase() as any);

    res.json({
      success: true,
      data: items,
    });
  })
);

export default router;
