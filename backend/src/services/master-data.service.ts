import prisma from '../utils/database';

type MasterDataType = 'SIZE' | 'CATEGORY' | 'DEPARTMENT';

export class MasterDataService {
  /**
   * Get all items of a type, sorted by order
   */
  async getByType(type: MasterDataType) {
    try {
      const items = await prisma.masterDataItem.findMany({
        where: { type },
        orderBy: { order: 'asc' },
        select: {
          id: true,
          value: true,
          order: true,
          type: true,
        },
      });

      return items;
    } catch (error) {
      console.error(`Error fetching ${type}:`, error);
      return [];
    }
  }

  /**
   * Add a new item (or get existing)
   */
  async addItem(type: MasterDataType, value: string): Promise<void> {
    const existingItems = await prisma.masterDataItem.findMany({
      where: { type },
      orderBy: { order: 'asc' },
    });

    const maxOrder = existingItems.length > 0 ? Math.max(...existingItems.map((i) => i.order)) : -1;

    await prisma.masterDataItem.upsert({
      where: { type_value: { type, value } },
      create: {
        type,
        value,
        order: maxOrder + 1,
      },
      update: {},
    });
  }

  /**
   * Remove an item
   */
  async removeItem(type: MasterDataType, value: string): Promise<void> {
    await prisma.masterDataItem.deleteMany({
      where: { type, value },
    });
  }

  /**
   * Reorder items (drag & drop)
   */
  async reorderItems(type: MasterDataType, orderedValues: string[]): Promise<void> {
    // Update order for each value
    for (let i = 0; i < orderedValues.length; i++) {
      await prisma.masterDataItem.updateMany({
        where: { type, value: orderedValues[i] },
        data: { order: i },
      });
    }
  }

  /**
   * Sync items from array (ensure all exist with proper order)
   */
  async syncItems(type: MasterDataType, values: string[]): Promise<void> {
    // Get existing items
    const existing = await prisma.masterDataItem.findMany({
      where: { type },
    });
    const existingMap = new Map(existing.map((item) => [item.value, item]));

    // Add new items with proper order
    for (let i = 0; i < values.length; i++) {
      const value = values[i];
      if (!existingMap.has(value)) {
        await prisma.masterDataItem.create({
          data: { type, value, order: i },
        });
      } else {
        // Update order if exists
        await prisma.masterDataItem.update({
          where: { type_value: { type, value } },
          data: { order: i },
        });
      }
    }

    // Remove items not in the new list
    for (const [value, item] of existingMap) {
      if (!values.includes(value)) {
        await prisma.masterDataItem.delete({
          where: { id: item.id },
        });
      }
    }
  }
}

export const masterDataService = new MasterDataService();
