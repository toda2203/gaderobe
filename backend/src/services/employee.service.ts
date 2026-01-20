import prisma from '../utils/database';
import logger from '../utils/logger';

export interface CreateEmployeeInput {
  firstName: string;
  lastName: string;
  email: string;
  department?: string;
}

export interface UpdateEmployeeInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  department?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'LEFT';
  role?: 'ADMIN' | 'WAREHOUSE' | 'HR' | 'READ_ONLY';
  isHidden?: boolean;
}

export class EmployeeService {
  /**
   * Get all employees with optional filtering
   * For READ_ONLY users: only return their own employee record
   */
  async getAllEmployees(filters?: { 
    status?: string; 
    role?: string; 
    department?: string; 
    includeHidden?: boolean;
    requestingUserId?: string; // For READ_ONLY filtering
    requestingUserRole?: string; // For READ_ONLY filtering
  }) {
    try {
      const where: any = filters?.includeHidden ? {} : { isHidden: false };

      if (filters?.status) {
        where.status = filters.status;
      }
      if (filters?.role) {
        where.role = filters.role;
      }
      if (filters?.department) {
        where.department = filters.department;
      }

      // READ_ONLY users can only see their own employee record
      if (filters?.requestingUserRole === 'READ_ONLY' && filters?.requestingUserId) {
        where.id = filters.requestingUserId;
      }

      const employees = await prisma.employee.findMany({
        where,
        include: {
          transactions: true,
          auditLogs: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      logger.info(`Retrieved ${employees.length} employees`);
      return employees;
    } catch (error) {
      logger.error('Error fetching employees:', error);
      throw new Error('Failed to fetch employees');
    }
  }

  /**
   * Get single employee by ID
   */
  async getEmployeeById(id: string) {
    try {
      const employee = await prisma.employee.findUnique({
        where: { id },
        include: {
          transactions: {
            include: {
              clothingItem: true,
            },
          },
          auditLogs: true,
        },
      });

      if (!employee) {
        throw new Error('Employee not found');
      }

      logger.info(`Retrieved employee: ${employee.email}`);
      return employee;
    } catch (error) {
      logger.error('Error fetching employee:', error);
      throw new Error('Failed to fetch employee');
    }
  }

  /**
   * Create new employee (DEPRECATED - use Entra ID sync instead)
   */
  async createEmployee(input: CreateEmployeeInput) {
    // Manual employee creation is no longer allowed
    // All employees must be synced from Microsoft Entra ID
    throw new Error('Manual employee creation is not allowed. Employees are automatically synchronized from Microsoft Entra ID. Please ensure the user exists in Entra ID and run a sync operation.');
  }

  /**
   * Update employee
   */
  async updateEmployee(id: string, input: UpdateEmployeeInput) {
    try {
      // Check if email exists and belongs to different employee
      if (input.email) {
        const existingEmployee = await prisma.employee.findUnique({
          where: { email: input.email },
        });

        if (existingEmployee && existingEmployee.id !== id) {
          throw new Error('Email already in use by another employee');
        }
      }

      const data: any = {};

      if (input.firstName) data.firstName = input.firstName;
      if (input.lastName) data.lastName = input.lastName;
      if (input.email) data.email = input.email;
      if (input.department) data.department = input.department;
      if (input.status) data.status = input.status;
      if (input.role) data.role = input.role;
      if (typeof input.isHidden === 'boolean') data.isHidden = input.isHidden;

      const employee = await prisma.employee.update({
        where: { id },
        data,
      });

      logger.info(`Updated employee: ${employee.email}`);

      // Create audit log
      await this.createAuditLog(id, 'UPDATE', input);

      return employee;
    } catch (error) {
      logger.error('Error updating employee:', error);
      throw error;
    }
  }

  /**
   * Delete employee (soft delete by marking as LEFT)
   */
  async deleteEmployee(id: string) {
    try {
      const employee = await prisma.employee.update({
        where: { id },
        data: {
          status: 'LEFT',
        },
      });

      logger.info(`Deleted employee: ${employee.email}`);

      // Create audit log
      await this.createAuditLog(id, 'DELETE', {
        status: 'LEFT',
      });

      return employee;
    } catch (error) {
      logger.error('Error deleting employee:', error);
      throw error;
    }
  }

  /**
   * Get employee by email (for OAuth login integration)
   */
  async getEmployeeByEmail(email: string) {
    try {
      const employee = await prisma.employee.findUnique({
        where: { email },
      });

      return employee;
    } catch (error) {
      logger.error('Error fetching employee by email:', error);
      throw error;
    }
  }

  /**
   * Get employees by department
   */
  async getEmployeesByDepartment(department: string) {
    try {
      const employees = await prisma.employee.findMany({
        where: {
          department,
          status: 'ACTIVE',
          isHidden: false,
        },
        orderBy: { lastName: 'asc' },
      });

      return employees;
    } catch (error) {
      logger.error('Error fetching employees by department:', error);
      throw error;
    }
  }

  /**
   * Create audit log entry
   */
  private async createAuditLog(employeeId: string, action: string, changes: any) {
    try {
      await prisma.auditLog.create({
        data: {
          entityType: 'Employee',
          entityId: employeeId,
          performedById: employeeId,
          action,
          changes: JSON.stringify(changes),
          ipAddress: '0.0.0.0',
          userAgent: 'employee-service',
        },
      });
    } catch (error) {
      logger.error('Error creating audit log:', error);
      // Don't throw - audit logging shouldn't block main operations
    }
  }

  /**
   * Get statistics
   */
  async getEmployeeStats() {
    try {
      const whereVisible = { isHidden: false };

      const total = await prisma.employee.count({ where: whereVisible });
      const active = await prisma.employee.count({ where: { ...whereVisible, status: 'ACTIVE' } });
      const inactive = await prisma.employee.count({ where: { ...whereVisible, status: 'INACTIVE' } });

      const byRole = await prisma.employee.groupBy({
        by: ['role'],
        where: whereVisible,
        _count: true,
      });

      const byDepartment = await prisma.employee.groupBy({
        by: ['department'],
        where: whereVisible,
        _count: true,
      });

      return {
        total,
        active,
        inactive,
        byRole: byRole.map((r: any) => ({ role: r.role, count: r._count })),
        byDepartment: byDepartment.map((d: any) => ({ department: d.department, count: d._count })),
      };
    } catch (error) {
      logger.error('Error getting employee stats:', error);
      throw error;
    }
  }
}

export const employeeService = new EmployeeService();
