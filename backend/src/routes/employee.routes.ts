import { Router } from 'express';
import { AuthenticatedRequest, authenticate, authorize } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { employeeService } from '../services/employee.service';

const router = Router();

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
    const employee = await employeeService.getEmployeeById(req.params.id);

    res.json({
      success: true,
      data: employee,
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
    const { firstName, lastName, email, department } = req.body;

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
    const employee = await employeeService.updateEmployee(req.params.id, req.body);

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
    const employee = await employeeService.deleteEmployee(req.params.id);

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
