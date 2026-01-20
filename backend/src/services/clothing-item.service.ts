import prisma from '../utils/database';
import logger from '../utils/logger';
import { nanoid } from 'nanoid';

export interface CreateClothingItemInput {
  typeId: string;
  size: string;
  category: 'PERSONALIZED' | 'POOL';
  condition?: 'NEW' | 'GOOD' | 'WORN' | 'RETIRED';
  personalizedForId?: string;
  purchaseDate?: Date;
  purchasePrice?: number;
  imageUrl?: string;
}

export interface BulkCreateClothingItemInput {
  typeId: string;
  size: string;
  category: 'PERSONALIZED' | 'POOL';
  condition?: 'NEW' | 'GOOD' | 'WORN' | 'RETIRED';
  quantity: number;
  purchaseDate?: Date;
  purchasePrice?: number;
  imageUrl?: string;
}

export interface UpdateClothingItemInput {
  size?: string;
  category?: 'PERSONALIZED' | 'POOL';
  condition?: 'NEW' | 'GOOD' | 'WORN' | 'RETIRED';
  status?: 'AVAILABLE' | 'ISSUED' | 'IN_USE' | 'RETURNED' | 'RETIRED' | 'LOST';
  personalizedForId?: string;
  currentEmployeeId?: string;
  purchaseDate?: Date;
  purchasePrice?: number;
  imageUrl?: string;
  retirementDate?: Date;
  retirementReason?: string;
}

export class ClothingItemService {
  /**
   * Generate unique internal ID and QR code
   */
  private generateInternalId(): string {
    const timestamp = Date.now().toString(36);
    const random = nanoid(6);
    return `CLO-${timestamp}-${random}`.toUpperCase();
  }

  private generateQRCode(): string {
    return nanoid(16).toUpperCase();
  }

  /**
   * Get all clothing items with optional filtering
   * For READ_ONLY users: only return items assigned to them
   */
  async getAllClothingItems(filters?: {
    typeId?: string;
    category?: string;
    status?: string;
    personalizedForId?: string;
    requestingUserId?: string; // For READ_ONLY filtering
    requestingUserRole?: string; // For READ_ONLY filtering
  }) {
    try {
      const where: any = {};

      if (filters?.typeId) where.typeId = filters.typeId;
      if (filters?.category) where.category = filters.category;
      if (filters?.status) where.status = filters.status;
      if (filters?.personalizedForId) where.personalizedForId = filters.personalizedForId;

      // READ_ONLY users can only see their own items
      if (filters?.requestingUserRole === 'READ_ONLY' && filters?.requestingUserId) {
        where.OR = [
          { personalizedForId: filters.requestingUserId },
          { currentEmployeeId: filters.requestingUserId }
        ];
      }

      const items = await prisma.clothingItem.findMany({
        where,
        include: {
          type: true,
          personalizedFor: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          currentEmployee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      logger.info(`Retrieved ${items.length} clothing items`);
      return items;
    } catch (error) {
      logger.error('Error fetching clothing items:', error);
      throw new Error('Failed to fetch clothing items');
    }
  }

  /**
   * Get single clothing item by ID
   */
  async getClothingItemById(id: string) {
    try {
      const item = await prisma.clothingItem.findUnique({
        where: { id },
        include: {
          type: true,
          personalizedFor: true,
          currentEmployee: true,
          transactions: {
            include: {
              employee: true,
              issuedBy: true,
              returnedBy: true,
            },
            orderBy: { issuedAt: 'desc' },
          },
        },
      });

      if (!item) {
        throw new Error('Clothing item not found');
      }

      logger.info(`Retrieved clothing item: ${item.internalId}`);
      return item;
    } catch (error) {
      logger.error('Error fetching clothing item:', error);
      throw error;
    }
  }

  /**
   * Get clothing item by QR code
   */
  async getClothingItemByQRCode(qrCode: string) {
    try {
      const item = await prisma.clothingItem.findUnique({
        where: { qrCode },
        include: {
          type: true,
          personalizedFor: true,
          currentEmployee: true,
        },
      });

      if (!item) {
        throw new Error('Clothing item not found');
      }

      return item;
    } catch (error) {
      logger.error('Error fetching clothing item by QR code:', error);
      throw error;
    }
  }

  /**
   * Get audit log for a specific clothing item
   */
  async getClothingItemAuditLog(clothingItemId: string) {
    try {
      // First check if the table exists by trying a simple query
      try {
        await prisma.$queryRaw`SELECT 1 FROM audit_logs LIMIT 1`;
      } catch (tableError: any) {
        if (tableError.message?.includes("Table") || tableError.message?.includes("doesn't exist")) {
          logger.warn('Audit logs table does not exist yet');
          return [];
        }
        throw tableError;
      }

      const auditLogs = await prisma.auditLog.findMany({
        where: {
          entityId: clothingItemId,
          entityType: 'ClothingItem'
        },
        include: {
          performedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
        },
        orderBy: { timestamp: 'desc' }
      });

      logger.info(`Retrieved ${auditLogs.length} audit log entries for clothing item: ${clothingItemId}`);
      return auditLogs;
    } catch (error) {
      logger.error('Error fetching audit log for clothing item:', error);
      
      // If it's a table not found error, return empty array instead of throwing
      if (error instanceof Error && (
        error.message?.includes("Table") || 
        error.message?.includes("audit_logs") ||
        error.message?.includes("doesn't exist")
      )) {
        logger.warn('Audit logs table not found, returning empty array');
        return [];
      }
      
      throw new Error('Failed to fetch audit log');
    }
  }

  /**
   * Bulk create multiple clothing items
   */
  async bulkCreateClothingItems(input: BulkCreateClothingItemInput, performedById?: string) {
    try {
      // Verify type exists
      const type = await prisma.clothingType.findUnique({
        where: { id: input.typeId },
      });

      if (!type) {
        throw new Error('Clothing type not found');
      }

      if (input.quantity < 1 || input.quantity > 100) {
        throw new Error('Quantity must be between 1 and 100');
      }

      // Create multiple items
      const items = [];
      const createPromises = [];

      for (let i = 0; i < input.quantity; i++) {
        const internalId = this.generateInternalId();
        const qrCode = this.generateQRCode();

        createPromises.push(
          prisma.clothingItem.create({
            data: {
              internalId,
              qrCode,
              typeId: input.typeId,
              size: input.size,
              category: input.category,
              condition: input.condition || 'NEW',
              status: 'AVAILABLE',
              isPersonalized: input.category === 'PERSONALIZED',
              purchaseDate: input.purchaseDate || new Date(),
              purchasePrice: input.purchasePrice || null,
              imageUrl: input.imageUrl || null,
            },
            include: {
              type: true,
            },
          })
        );
      }

      const createdItems = await Promise.all(createPromises);

      // Create audit logs for all created items
      if (performedById) {
        const auditPromises = createdItems.map(item => 
          this.createAuditLog(item.id, 'CREATE', {
            internalId: item.internalId,
            type: type.name,
            size: item.size,
            category: item.category,
            condition: item.condition,
            status: item.status,
            purchasePrice: item.purchasePrice,
          }, performedById)
        );
        
        await Promise.all(auditPromises);
      }

      logger.info(`Bulk created ${createdItems.length} clothing items for type: ${type.name}`);
      return createdItems;
    } catch (error) {
      logger.error('Error bulk creating clothing items:', error);
      throw error;
    }
  }

  /**
   * Create new clothing item
   */
  async createClothingItem(input: CreateClothingItemInput, performedById?: string) {
    try {
      // Verify type exists
      const type = await prisma.clothingType.findUnique({
        where: { id: input.typeId },
      });

      if (!type) {
        throw new Error('Clothing type not found');
      }

      // Verify employee if personalized
      if (input.personalizedForId) {
        const employee = await prisma.employee.findUnique({
          where: { id: input.personalizedForId },
        });

        if (!employee) {
          throw new Error('Employee not found');
        }
      }

      const internalId = this.generateInternalId();
      const qrCode = this.generateQRCode();

      const item = await prisma.clothingItem.create({
        data: {
          internalId,
          qrCode,
          typeId: input.typeId,
          size: input.size,
          category: input.category,
          condition: input.condition || 'NEW',
          status: 'AVAILABLE',
          isPersonalized: input.category === 'PERSONALIZED',
          personalizedForId: input.personalizedForId || null,
          purchaseDate: input.purchaseDate || new Date(),
          purchasePrice: input.purchasePrice || null,
          imageUrl: input.imageUrl || null,
        },
        include: {
          type: true,
          personalizedFor: true,
        },
      });

      // Create audit log for creation
      await this.createAuditLog(item.id, 'CREATE', {
        internalId: item.internalId,
        type: type.name,
        size: item.size,
        category: item.category,
        condition: item.condition,
        status: item.status,
        purchasePrice: item.purchasePrice,
      }, performedById);

      logger.info(`Created clothing item: ${item.internalId}`);
      return item;
    } catch (error) {
      logger.error('Error creating clothing item:', error);
      throw error;
    }
  }

  /**
   * Update clothing item
   */
  async updateClothingItem(id: string, input: UpdateClothingItemInput, performedById?: string) {
    try {
      // Get current item for audit log
      const currentItem = await prisma.clothingItem.findUnique({
        where: { id },
        include: {
          type: true,
          personalizedFor: true,
          currentEmployee: true,
        },
      });

      if (!currentItem) {
        throw new Error('Clothing item not found');
      }

      const data: any = {};

      if (input.size) data.size = input.size;
      if (input.category) {
        data.category = input.category;
        data.isPersonalized = input.category === 'PERSONALIZED';
      }
      if (input.condition) data.condition = input.condition;
      if (input.status) data.status = input.status;
      if (input.personalizedForId !== undefined) data.personalizedForId = input.personalizedForId;
      if (input.currentEmployeeId !== undefined) data.currentEmployeeId = input.currentEmployeeId;
      if (input.purchaseDate) data.purchaseDate = input.purchaseDate;
      if (input.purchasePrice !== undefined) data.purchasePrice = input.purchasePrice;
      if (input.imageUrl !== undefined) data.imageUrl = input.imageUrl;
      if (input.retirementDate) data.retirementDate = input.retirementDate;
      if (input.retirementReason) data.retirementReason = input.retirementReason;

      const item = await prisma.clothingItem.update({
        where: { id },
        data,
        include: {
          type: true,
          personalizedFor: true,
          currentEmployee: true,
        },
      });

      // Create audit log for the changes
      const changes: any = {};
      
      if (input.size && currentItem.size !== input.size) {
        changes.size = { old: currentItem.size, new: input.size };
      }
      if (input.category && currentItem.category !== input.category) {
        changes.category = { old: currentItem.category, new: input.category };
      }
      if (input.condition && currentItem.condition !== input.condition) {
        changes.condition = { old: currentItem.condition, new: input.condition };
      }
      if (input.status && currentItem.status !== input.status) {
        changes.status = { old: currentItem.status, new: input.status };
      }
      if (input.purchasePrice !== undefined && currentItem.purchasePrice !== input.purchasePrice) {
        changes.purchasePrice = { old: currentItem.purchasePrice, new: input.purchasePrice };
      }
      if (input.imageUrl !== undefined && currentItem.imageUrl !== input.imageUrl) {
        changes.imageUrl = { old: currentItem.imageUrl ? 'Vorhanden' : 'Nicht vorhanden', new: input.imageUrl ? 'Vorhanden' : 'Nicht vorhanden' };
      }
      if (input.personalizedForId !== undefined && currentItem.personalizedForId !== input.personalizedForId) {
        changes.personalizedForId = { old: currentItem.personalizedForId, new: input.personalizedForId };
      }
      if (input.currentEmployeeId !== undefined && currentItem.currentEmployeeId !== input.currentEmployeeId) {
        changes.currentEmployeeId = { old: currentItem.currentEmployeeId, new: input.currentEmployeeId };
      }
      
      // Only create audit log if there are actual changes
      if (Object.keys(changes).length > 0) {
        await this.createAuditLog(id, 'UPDATE', changes, performedById);
      }

      logger.info(`Updated clothing item: ${item.internalId}`);
      return item;
    } catch (error) {
      logger.error('Error updating clothing item:', error);
      throw error;
    }
  }

  /**
   * Delete clothing item (soft delete by retiring)
   */
  async deleteClothingItem(id: string, reason?: string, performedById?: string) {
    try {
      // Get current item for audit log
      const currentItem = await prisma.clothingItem.findUnique({
        where: { id },
        include: { type: true },
      });

      if (!currentItem) {
        throw new Error('Clothing item not found');
      }

      const item = await prisma.clothingItem.update({
        where: { id },
        data: {
          status: 'RETIRED',
          retirementDate: new Date(),
          retirementReason: reason || 'Deleted by user',
        },
      });

      // Create audit log for deletion/retirement
      await this.createAuditLog(id, 'RETIRE', {
        internalId: currentItem.internalId,
        type: currentItem.type.name,
        previousStatus: currentItem.status,
        retirementReason: reason || 'Deleted by user',
      }, performedById);

      logger.info(`Retired clothing item: ${item.internalId}`);
      return item;
    } catch (error) {
      logger.error('Error deleting clothing item:', error);
      throw error;
    }
  }

  /**
   * Permanently delete a retired clothing item (hard delete, ADMIN only)
   */
  async permanentlyDeleteClothingItem(id: string, performedById?: string) {
    try {
      // Get current item for validation and audit log
      const currentItem = await prisma.clothingItem.findUnique({
        where: { id },
        include: { 
          type: true,
          transactions: true,
        },
      });

      if (!currentItem) {
        throw new Error('Kleidungsstück nicht gefunden');
      }

      // Only allow deletion of RETIRED items
      if (currentItem.status !== 'RETIRED') {
        throw new Error('Nur ausgemusterte Kleidungsstücke können dauerhaft gelöscht werden. Bitte zuerst ausmustern.');
      }

      // Check if there are any associated transactions
      if (currentItem.transactions && currentItem.transactions.length > 0) {
        throw new Error(`Kleidungsstück kann nicht gelöscht werden, da ${currentItem.transactions.length} Transaktion(en) damit verknüpft sind.`);
      }

      // Create audit log before deletion
      await this.createAuditLog(id, 'PERMANENT_DELETE', {
        internalId: currentItem.internalId,
        type: currentItem.type.name,
        status: currentItem.status,
        retirementReason: currentItem.retirementReason,
      }, performedById);

      // Permanently delete the item
      const deletedItem = await prisma.clothingItem.delete({
        where: { id },
      });

      logger.info(`Permanently deleted clothing item: ${currentItem.internalId}`);
      return deletedItem;
    } catch (error) {
      logger.error('Error permanently deleting clothing item:', error);
      throw error;
    }
  }

  /**
   * Get statistics
   */
  async getClothingItemStats() {
    try {
      const total = await prisma.clothingItem.count();
      const available = await prisma.clothingItem.count({ where: { status: 'AVAILABLE' } });
      const issued = await prisma.clothingItem.count({ where: { status: 'ISSUED' } });
      const retired = await prisma.clothingItem.count({ where: { status: 'RETIRED' } });

      const byCategory = await prisma.clothingItem.groupBy({
        by: ['category'],
        _count: true,
      });

      const byCondition = await prisma.clothingItem.groupBy({
        by: ['condition'],
        _count: true,
      });

      const byStatus = await prisma.clothingItem.groupBy({
        by: ['status'],
        _count: true,
      });

      return {
        total,
        available,
        issued,
        retired,
        byCategory: byCategory.map((c: any) => ({ category: c.category, count: c._count })),
        byCondition: byCondition.map((c: any) => ({ condition: c.condition, count: c._count })),
        byStatus: byStatus.map((s: any) => ({ status: s.status, count: s._count })),
      };
    } catch (error) {
      logger.error('Error getting clothing item stats:', error);
      throw error;
    }
  }

  /**
   * Create audit log entry
   */
  private async createAuditLog(itemId: string, action: string, changes: any, performedById?: string) {
    try {
      // First check if the table exists
      try {
        await prisma.$queryRaw`SELECT 1 FROM audit_logs LIMIT 1`;
      } catch (tableError: any) {
        if (tableError.message?.includes("Table") || tableError.message?.includes("doesn't exist")) {
          logger.warn('Audit logs table does not exist, skipping audit log creation');
          return;
        }
        throw tableError;
      }

      // Only create audit log if we have a valid performedById
      if (!performedById) {
        logger.warn('No performedById provided for audit log, skipping');
        return;
      }

      await prisma.auditLog.create({
        data: {
          entityType: 'ClothingItem',
          entityId: itemId,
          performedById: performedById,
          action,
          changes: JSON.stringify(changes),
          ipAddress: '0.0.0.0',
          userAgent: 'clothing-item-service',
        },
      });
      
      logger.info(`Audit log created for item ${itemId}: ${action} by ${performedById}`);
    } catch (error) {
      logger.error('Error creating audit log:', error);
      // Don't throw - audit logging shouldn't block main operations
    }
  }
}

export const clothingItemService = new ClothingItemService();
