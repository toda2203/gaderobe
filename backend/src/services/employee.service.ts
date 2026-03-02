import prisma from '../utils/database';
import logger from '../utils/logger';


export interface CreateEmployeeInput {
  firstName: string;
  lastName: string;
  email: string;
  department?: string;
  passwordHash?: string;
  passwordPlain?: string;
  sendCredentials?: boolean;
  profileImageUrl?: string;
}


export interface UpdateEmployeeInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  department?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'LEFT';
  role?: 'ADMIN' | 'WAREHOUSE' | 'HR' | 'READ_ONLY';
  isHidden?: boolean;
  passwordPlain?: string;
  sendCredentials?: boolean;
  profileImageUrl?: string;
}

class EmployeeService {
    async getEmployeesByDepartment(department: string) {
      return await prisma.employee.findMany({
        where: { department },
        include: {
          transactions: true,
          auditLogs: true,
        },
        orderBy: { lastName: 'asc' },
      });
    }
  // sendCredentialsMail entfernt – Versand erfolgt jetzt ausschließlich über EmailService.sendCredentialsEmail

  async getAllEmployees(filters: any) {
    let where: any = {};
    if (!filters || !filters.includeHidden) where.isHidden = false;
    if (filters && filters.status) where.status = filters.status;
    if (filters && filters.role) where.role = filters.role;
    if (filters && filters.department) where.department = filters.department;
    if (filters && filters.requestingUserRole === 'READ_ONLY' && filters.requestingUserId) where.id = filters.requestingUserId;
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
  }

  async getEmployeeById(id: string) {
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
    return employee;
  }

  async updateEmployee(id: string, input: UpdateEmployeeInput, performedById?: string) {
    if (input.email) {
      const existingEmployee = await prisma.employee.findUnique({
        where: { email: input.email },
      });
      // Typkonflikt vermeiden: id als String vergleichen
      if (existingEmployee && String(existingEmployee.id) !== String(id)) {
        throw new Error('E-Mail bereits vergeben');
      }
    }
    const data = {} as any;
    if (input.firstName) data.firstName = input.firstName;
    if (input.lastName) data.lastName = input.lastName;
    if (input.email) data.email = input.email;
    if (input.department) data.department = input.department;
    if (input.status) data.status = input.status;
    if (input.role) data.role = input.role;
    if (typeof input.isHidden === 'boolean') data.isHidden = input.isHidden;
    if (input.profileImageUrl) data.profileImageUrl = input.profileImageUrl;

    // Passwort-Logik: Nur passwordPlain prüfen und hashen, falls gesetzt
    if (typeof input.passwordPlain === 'string' && input.passwordPlain.length > 0) {
      const bcrypt = require('bcryptjs');
      data.passwordHash = await bcrypt.hash(input.passwordPlain, 10);
      console.log('[updateEmployee] passwordHash gesetzt:', data.passwordHash);
    }
    // Entferne alle undefined-Felder aus data
    Object.keys(data).forEach(key => data[key] === undefined && delete data[key]);
    const employee = await prisma.employee.update({
      where: { id },
      data,
    });
    logger.info(`Updated employee: ${employee.email}`);
    await this.createAuditLog(id, 'UPDATE', input, performedById);
    // Zugangsdaten-Mail nur noch über EmailService.sendCredentialsEmail versenden
    if ((input.sendCredentials == true) && input.email) {
      try {
        const EmailService = require('./email.service').EmailService;
        const emailService = new EmailService();
        await emailService.sendCredentialsEmail(
          input.email,
          input.firstName || '',
          input.lastName || '',
          input.passwordPlain || ''
        );
        console.log('[MAIL] Zugangsdaten-Mail versendet an', input.email);
      } catch (err) {
        console.error('[MAIL] Fehler beim Versand der Zugangsdaten-Mail an', input.email, ':', err?.message || err);
      }
    }
    return employee;
    }
  
    async createEmployee(input: CreateEmployeeInput) {
      const existing = await prisma.employee.findUnique({ where: { email: input.email } });
      if (existing) {
        throw new Error('E-Mail bereits vergeben');
      }
      let passwordHash = '';
      if (input.passwordPlain) {
        const bcrypt = require('bcryptjs');
        passwordHash = await bcrypt.hash(input.passwordPlain, 10);
      } else if (input.passwordHash) {
        passwordHash = input.passwordHash;
      }
      const employee = await prisma.employee.create({
        data: {
          email: input.email,
          firstName: input.firstName,
          lastName: input.lastName,
          department: input.department,
          status: 'ACTIVE',
          role: 'READ_ONLY',
          isHidden: false,
          passwordHash,
          profileImageUrl: input.profileImageUrl,
        },
      });
      console.log('[MAIL-DEBUG] input.sendCredentials:', input.sendCredentials, '(', typeof input.sendCredentials, ')');
      console.log('[MAIL-DEBUG] input.passwordPlain:', input.passwordPlain, '(', typeof input.passwordPlain, ')');
      // Zugangsdaten-Mail nur noch über EmailService.sendCredentialsEmail versenden
      if ((input.sendCredentials == true) && input.passwordPlain) {
        try {
          const EmailService = require('./email.service').EmailService;
          const emailService = new EmailService();
          await emailService.sendCredentialsEmail(
            input.email,
            input.firstName || '',
            input.lastName || '',
            input.passwordPlain || ''
          );
          console.log('[MAIL] Zugangsdaten-Mail versendet an', input.email);
        } catch (err) {
          console.error('[MAIL] Fehler beim Versand der Zugangsdaten-Mail an', input.email, ':', err?.message || err);
        }
      } else {
        console.log('[MAIL-DEBUG] Bedingung NICHT erfüllt, kein Mailversand!');
      }
      // ...dann wie gewohnt patchen
      return employee;
    }
  
    async deleteEmployee(id: string, performedById?: string) {
      const employee = await prisma.employee.findUnique({ where: { id } });
      if (!employee) throw new Error('Mitarbeiter nicht gefunden');
      if (employee.status === 'LEFT') {
        // Hard delete: remove all dependent records first
        await prisma.transaction.deleteMany({ where: { employeeId: id } });
        await prisma.auditLog.deleteMany({ where: { performedById: id } });
        await prisma.auditLog.deleteMany({ where: { entityId: id } });
        await prisma.employee.delete({ where: { id } });
        logger.info(`Permanently deleted employee: ${employee.email}`);
        await this.createAuditLog(id, 'DELETE', { status: 'PERMANENTLY_DELETED' }, performedById);
        return { id, email: employee.email, status: 'PERMANENTLY_DELETED' };
      } else {
        const updated = await prisma.employee.update({
          where: { id },
          data: { status: 'LEFT' },
        });
        logger.info(`Soft deleted employee: ${updated.email}`);
        await this.createAuditLog(id, 'DELETE', { status: 'LEFT' }, performedById);
        return updated;
      }
    }
  
    private async createAuditLog(employeeId: string, action: string, changes: any, performedById?: string) {
      await prisma.auditLog.create({
        data: {
          entityType: 'Employee',
          entityId: employeeId,
          performedById: performedById || employeeId,
          action,
          changes: JSON.stringify(changes),
          ipAddress: '0.0.0.0',
          userAgent: 'employee-service',
        },
      });
    }

    async getEmployeeStats() {
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
    }
  }
  export const employeeService = new EmployeeService();
