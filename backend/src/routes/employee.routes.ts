import { Router } from 'express';
import { AuthenticatedRequest, authenticate, authorize } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { employeeService } from '../services/employee.service';
import { upload } from '../middleware/upload';
import path from 'path';

const router = Router();
/**
 * POST /api/employees/upload-profile-image
 * Profilbild hochladen (für eingeloggten User)
 */
router.post(
  '/upload-profile-image',
  upload.single('image'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Kein Bild hochgeladen' });
    }
    // Bild-URL bauen (relativ zum public-Ordner)
    const fileName = req.file.filename;
    const imageUrl = `/uploads/clothing-images/${fileName}`;
    // Optional: Im Profil speichern, falls User bekannt
    if (req.user && req.user.id) {
      await employeeService.updateEmployee(req.user.id, { profileImageUrl: imageUrl });
    }
    res.json({ success: true, url: imageUrl });
  })
);


// All routes require authentication

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/employees
 * Get all employees with optional filtering
 */
router.get(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { status, role, department } = req.query;
    const requesterRole = req.user?.role;
    const requesterId = req.user?.id;
    const includeHidden =
      req.query.includeHidden === 'true' && requesterRole && requesterRole !== 'READ_ONLY';

    const filters = {
      status: status as string,
      role: role as string,
      department: department as string,
      includeHidden,
      requestingUserId: requesterId, // Pass current user ID
      requestingUserRole: requesterRole, // Pass current user role
    };

    const employees = await employeeService.getAllEmployees(filters);

    res.json({
      success: true,
      data: employees,
    });
  })
);

/**
 * GET /api/employees/stats
 * Get employee statistics
 */
router.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const stats = await employeeService.getEmployeeStats();

    res.json({
      success: true,
      data: stats,
    });
  })
);

/**
 * GET /api/employees/:id
 * Get single employee by ID
 */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const user = req.user; // angenommen, req.user wird durch Auth-Middleware gesetzt
    const requestedId = req.params.id;
    // Zugriff nur auf eigenes Profil oder als Admin
    if (!user) {
      return res.status(401).json({ success: false, error: 'Nicht authentifiziert' });
    }
    if (user.role !== 'ADMIN' && user.id !== requestedId) {
      return res.status(403).json({ success: false, error: 'Kein Zugriff erlaubt' });
    }
    const employee = await employeeService.getEmployeeById(requestedId);
    if (!employee) {
      return res.status(404).json({ success: false, error: 'Mitarbeiter nicht gefunden' });
    }
    // Nur erlaubte Felder zurückgeben
    const safeEmployee = {
      id: employee.id,
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email,
      department: employee.department,
      status: employee.status,
      role: employee.role,
      isHidden: employee.isHidden,
      createdAt: employee.createdAt,
      updatedAt: employee.updatedAt,
      profileImageUrl: employee.profileImageUrl,
    };
    res.json({
      success: true,
      data: safeEmployee,
    });
  })
);

/**
 * POST /api/employees
 * Create new employee (ADMIN only)
 */
router.post(
  '/',
  authorize('ADMIN', 'WAREHOUSE', 'HR'),
  asyncHandler(async (req, res) => {
    // Debug: Logge den kompletten Request-Body und prüfe Passwortfelder
    console.log('[POST /api/employees] req.body:', JSON.stringify(req.body));
    if (req.body.passwordPlain) {
      console.log('[POST /api/employees] passwordPlain im Body:', req.body.passwordPlain);
    }
    if (req.body.password) {
      console.log('[POST /api/employees] password im Body:', req.body.password);
    }
    const { firstName, lastName, email, department, passwordPlain, passwordHash, sendCredentials } = req.body;

    if (!firstName || !lastName || !email) {
      return res.status(400).json({
        success: false,
        error: 'firstName, lastName, and email are required',
      });
    }

    const employee = await employeeService.createEmployee({
      firstName,
      lastName,
      email,
      department,
      passwordPlain,
      passwordHash,
      sendCredentials,
      profileImageUrl: req.body.profileImageUrl,
    });

    res.status(201).json({
      success: true,
      data: employee,
    });
  })
);

/**
 * PATCH /api/employees/:id
 * Update employee (ADMIN only)
 */
router.patch(
  '/:id',
  authorize('ADMIN', 'WAREHOUSE', 'HR'),
  asyncHandler(async (req, res) => {
    // Debug: Logge den kompletten Request-Body und prüfe Passwortfelder
    console.log('[PATCH /api/employees/:id] req.body:', JSON.stringify(req.body));
    if (req.body.passwordPlain) {
      console.log('[PATCH /api/employees/:id] passwordPlain im Body:', req.body.passwordPlain);
    }
    if (req.body.password) {
      console.log('[PATCH /api/employees/:id] password im Body:', req.body.password);
    }
    // Fallback: Wenn passwordPlain fehlt, aber password vorhanden ist, nutze password
    if (!req.body.passwordPlain && req.body.password) {
      req.body.passwordPlain = req.body.password;
    }
    const employee = await employeeService.updateEmployee(req.params.id, req.body, req.user?.id);

    res.json({
      success: true,
      data: employee,
    });
  })
);

/**
 * DELETE /api/employees/:id
 * Soft delete employee (ADMIN only)
 */
router.delete(
  '/:id',
  authorize('ADMIN', 'WAREHOUSE', 'HR'),
  asyncHandler(async (req, res) => {
    const employee = await employeeService.deleteEmployee(req.params.id, req.user?.id);

    res.json({
      success: true,
      data: employee,
      message: 'Employee marked as LEFT',
    });
  })
);

/**
 * GET /api/employees/department/:department
 * Get employees by department
 */
router.get(
  '/department/:department',
  asyncHandler(async (req, res) => {
    const employees = await employeeService.getEmployeesByDepartment(req.params.department);

    res.json({
      success: true,
      data: employees,
    });
  })
);

export default router;
