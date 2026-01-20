import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { entraIdSyncService } from '../services/entraid-sync.service';

const router = Router();

/**
 * GET /api/sync/status
 * Get the current sync status
 */
router.get(
  '/status',
  authenticate,
  asyncHandler(async (req, res) => {
    const status = await entraIdSyncService.getSyncStatus();

    res.json({
      success: true,
      data: status,
    });
  })
);

/**
 * POST /api/sync/employees
 * Manually trigger Entra ID sync (ADMIN only)
 */
router.post(
  '/employees',
  authenticate,
  authorize('ADMIN'),
  asyncHandler(async (req, res) => {
    const result = await entraIdSyncService.syncUsersFromEntraId();

    res.json({
      success: true,
      message: 'Entra ID sync completed successfully',
      data: result,
    });
  })
);

export default router;
