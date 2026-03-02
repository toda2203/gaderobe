import { Router } from 'express';
import { authService } from '../services/auth.service';
import { asyncHandler } from '../middleware/error.middleware';
import { authenticate } from '../middleware/auth.middleware';
import { authRateLimiter } from '../middleware/rate-limit.middleware';
import prisma from '../utils/database';

const router = Router();


/**
 * @route   POST /api/auth/login
 * @desc    Lokaler Login (E-Mail + Passwort)
 */
router.post(
  '/login',
  authRateLimiter,
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_CREDENTIALS', message: 'E-Mail und Passwort erforderlich' },
        timestamp: new Date().toISOString(),
      });
    }
    try {
      const result = await authService.localLogin(email, password);
      res.json({ success: true, data: result });
    } catch (error: any) {
      // Logging für Fehleranalyse
      // eslint-disable-next-line no-console
      console.error('[LOGIN ERROR]', {
        error: error,
        email,
        time: new Date().toISOString(),
        path: req.path,
        body: req.body,
      });
      res.status(401).json({
        success: false,
        error: { code: 'LOGIN_FAILED', message: error.message },
        timestamp: new Date().toISOString(),
      });
    }
  })
);

/**
 * @route   POST /api/auth/set-password
 * @desc    Passwort setzen/ändern (nur für eingeloggte User oder Admin)
 */
router.post(
  '/set-password',
  authenticate,
  asyncHandler(async (req: any, res) => {
    const { password, userId } = req.body;
    const targetUserId = userId || req.user.id;
    if (!password) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_PASSWORD', message: 'Passwort erforderlich' },
        timestamp: new Date().toISOString(),
      });
    }
    // Nur Admin darf für andere setzen
    if (userId && req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Nur Admin darf für andere Nutzer das Passwort setzen.' },
        timestamp: new Date().toISOString(),
      });
    }
    await authService.setPassword(targetUserId, password);
    res.json({ success: true });
  })
);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token
 * @access  Public (with refresh token)
 */


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
