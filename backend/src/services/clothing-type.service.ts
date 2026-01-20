import prisma from '../utils/database';
import logger from '../utils/logger';

export interface CreateClothingTypeInput {
  name: string;
  description?: string;
  category: string;
  availableSizes: string[];
  expectedLifespanMonths?: number;
  requiresDepartment?: string[];
  imageUrl?: string;
}

export interface UpdateClothingTypeInput {
  name?: string;
  description?: string;
  category?: string;
  availableSizes?: string[];
  expectedLifespanMonths?: number;
  requiresDepartment?: string[];
  imageUrl?: string;
  isActive?: boolean;
}

export class ClothingTypeService {
  /**
   * Get all clothing types with optional filtering
   */
  async getAllClothingTypes(filters?: { category?: string; isActive?: boolean }) {
    try {
      const where: any = {};

      if (filters?.category) {
        where.category = filters.category;
      }
      if (typeof filters?.isActive === 'boolean') {
        where.isActive = filters.isActive;
      }

      const clothingTypes = await prisma.clothingType.findMany({
        where,
        include: {
          items: {
            select: {
              id: true,
              status: true,
            },
          },
          departmentAllocations: true,
        },
        orderBy: { name: 'asc' },
      });

      // Add item counts
      const typesWithCounts = clothingTypes.map((type) => ({
        ...type,
        availableSizes: JSON.parse(type.availableSizes),
        requiresDepartment: type.requiresDepartment ? JSON.parse(type.requiresDepartment) : null,
        itemCount: type.items.length,
        availableCount: type.items.filter((item) => item.status === 'AVAILABLE').length,
      }));

      logger.info(`Retrieved ${typesWithCounts.length} clothing types`);
      return typesWithCounts;
    } catch (error) {
      logger.error('Error fetching clothing types:', error);
      throw new Error('Failed to fetch clothing types');
    }
  }

  /**
   * Get single clothing type by ID
   */
  async getClothingTypeById(id: string) {
    try {
      const clothingType = await prisma.clothingType.findUnique({
        where: { id },
        include: {
          items: {
            include: {
              currentEmployee: true,
              personalizedFor: true,
            },
          },
          departmentAllocations: true,
        },
      });

      if (!clothingType) {
        throw new Error('Clothing type not found');
      }

      const result = {
        ...clothingType,
        availableSizes: JSON.parse(clothingType.availableSizes),
        requiresDepartment: clothingType.requiresDepartment
          ? JSON.parse(clothingType.requiresDepartment)
          : null,
      };

      logger.info(`Retrieved clothing type: ${clothingType.name}`);
      return result;
    } catch (error) {
      logger.error('Error fetching clothing type:', error);
      throw error;
    }
  }

  /**
   * Create new clothing type
   */
  async createClothingType(input: CreateClothingTypeInput) {
    try {
      // Check if name already exists
      const existing = await prisma.clothingType.findUnique({
        where: { name: input.name },
      });

      if (existing) {
        throw new Error('Clothing type with this name already exists');
      }

      const clothingType = await prisma.clothingType.create({
        data: {
          name: input.name,
          description: input.description || null,
          category: input.category,
          availableSizes: JSON.stringify(input.availableSizes),
          expectedLifespanMonths: input.expectedLifespanMonths || null,
          requiresDepartment: input.requiresDepartment
            ? JSON.stringify(input.requiresDepartment)
            : null,
          imageUrl: input.imageUrl || null,
          isActive: true,
        },
      });

      logger.info(`Created clothing type: ${clothingType.name}`);
      return {
        ...clothingType,
        availableSizes: JSON.parse(clothingType.availableSizes),
        requiresDepartment: clothingType.requiresDepartment
          ? JSON.parse(clothingType.requiresDepartment)
          : null,
      };
    } catch (error) {
      logger.error('Error creating clothing type:', error);
      throw error;
    }
  }

  /**
   * Update clothing type
   */
  async updateClothingType(id: string, input: UpdateClothingTypeInput) {
    try {
      // Check if name exists and belongs to different type
      if (input.name) {
        const existing = await prisma.clothingType.findUnique({
          where: { name: input.name },
        });

        if (existing && existing.id !== id) {
          throw new Error('Name already in use by another clothing type');
        }
      }

      const data: any = {};

      if (input.name) data.name = input.name;
      if (input.description !== undefined) data.description = input.description || null;
      if (input.category) data.category = input.category;
      if (input.availableSizes) data.availableSizes = JSON.stringify(input.availableSizes);
      if (input.expectedLifespanMonths !== undefined)
        data.expectedLifespanMonths = input.expectedLifespanMonths || null;
      if (input.requiresDepartment !== undefined)
        data.requiresDepartment = input.requiresDepartment
          ? JSON.stringify(input.requiresDepartment)
          : null;
      if (input.imageUrl !== undefined) data.imageUrl = input.imageUrl || null;
      if (typeof input.isActive === 'boolean') data.isActive = input.isActive;

      const clothingType = await prisma.clothingType.update({
        where: { id },
        data,
      });

      logger.info(`Updated clothing type: ${clothingType.name}`);
      return {
        ...clothingType,
        availableSizes: JSON.parse(clothingType.availableSizes),
        requiresDepartment: clothingType.requiresDepartment
          ? JSON.parse(clothingType.requiresDepartment)
          : null,
      };
    } catch (error) {
      logger.error('Error updating clothing type:', error);
      throw error;
    }
  }

  /**
   * Delete clothing type (soft delete by marking as inactive)
   */
  async deleteClothingType(id: string) {
    try {
      const clothingType = await prisma.clothingType.update({
        where: { id },
        data: { isActive: false },
      });

      logger.info(`Deactivated clothing type: ${clothingType.name}`);
      return clothingType;
    } catch (error) {
      logger.error('Error deleting clothing type:', error);
      throw error;
    }
  }

  /**
   * Permanently delete an inactive clothing type (hard delete, ADMIN only)
   */
  async permanentlyDeleteClothingType(id: string) {
    try {
      // Get current type for validation
      const clothingType = await prisma.clothingType.findUnique({
        where: { id },
        include: {
          items: true,
        },
      });

      if (!clothingType) {
        throw new Error('Kleidungstyp nicht gefunden');
      }

      // Only allow deletion of inactive types
      if (clothingType.isActive) {
        throw new Error('Nur deaktivierte Kleidungstypen können dauerhaft gelöscht werden. Bitte zuerst deaktivieren.');
      }

      // Check if there are any associated clothing items
      if (clothingType.items.length > 0) {
        throw new Error(`Kleidungstyp kann nicht gelöscht werden, da ${clothingType.items.length} Kleidungsstück(e) damit verknüpft sind. Bitte zuerst alle Artikel löschen.`);
      }

      // Permanently delete the type
      const deletedType = await prisma.clothingType.delete({
        where: { id },
      });

      logger.info(`Permanently deleted clothing type: ${clothingType.name}`);
      return deletedType;
    } catch (error) {
      logger.error('Error permanently deleting clothing type:', error);
      throw error;
    }
  }

  /**
   * Get statistics
   */
  async getClothingTypeStats() {
    try {
      const total = await prisma.clothingType.count();
      const active = await prisma.clothingType.count({ where: { isActive: true } });

      const byCategory = await prisma.clothingType.groupBy({
        by: ['category'],
        _count: true,
        where: { isActive: true },
      });

      const totalItems = await prisma.clothingItem.count();
      const availableItems = await prisma.clothingItem.count({
        where: { status: 'AVAILABLE' },
      });

      return {
        total,
        active,
        inactive: total - active,
        byCategory: byCategory.map((c: any) => ({ category: c.category, count: c._count })),
        totalItems,
        availableItems,
      };
    } catch (error) {
      logger.error('Error getting clothing type stats:', error);
      throw error;
    }
  }
}

export const clothingTypeService = new ClothingTypeService();
