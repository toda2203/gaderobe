import { Router } from 'express';
import { authService } from '../services/auth.service';
import { asyncHandler } from '../middleware/error.middleware';
import { authenticate } from '../middleware/auth.middleware';
import { authRateLimiter } from '../middleware/rate-limit.middleware';
import { config } from '../config';
import prisma from '../utils/database';

const router = Router();

/**
 * @route   GET /api/auth/login
 * @desc    Initiate Microsoft Entra ID login
 * @access  Public
 */
router.get(
  '/login',
  authRateLimiter,
  asyncHandler(async (req, res) => {
    const authUrl = await authService.getAuthUrl(config.azure.redirectUri);
    res.json({
      success: true,
      data: { authUrl },
    });
  })
);

/**
 * @route   GET /api/auth/callback
 * @desc    Handle callback from Microsoft after authentication
 * @access  Public
 */
router.get(
  '/callback',
  authRateLimiter,
  asyncHandler(async (req, res) => {
    const { code } = req.query;

    if (!code || typeof code !== 'string') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_AUTH_CODE',
          message: 'Authorization code is required',
        },
      });
    }

    const result = await authService.handleCallback(code, config.azure.redirectUri);

    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  })
);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token
 * @access  Public (with refresh token)
 */
router.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_REFRESH_TOKEN',
          message: 'Refresh token is required',
        },
      });
    }

    const result = await authService.refreshAccessToken(refreshToken);

    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  })
);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post(
  '/logout',
  authenticate,
  asyncHandler(async (req, res) => {
    // In a production app, you might want to blacklist the token
    res.json({
      success: true,
      message: 'Erfolgreich abgemeldet',
      timestamp: new Date().toISOString(),
    });
  })
);

/**
 * @route   GET /api/auth/me
 * @desc    Get current user info
 * @access  Private
 */
router.get(
  '/me',
  authenticate,
  asyncHandler(async (req: any, res) => {
    const employee = await prisma.employee.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        department: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    res.json({
      success: true,
      data: employee,
      timestamp: new Date().toISOString(),
    });
  })
);

export default router;
