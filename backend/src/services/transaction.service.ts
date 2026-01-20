import prisma from '../utils/database';
import logger from '../utils/logger';

export interface IssueClothingInput {
  employeeId: string;
  clothingItemId: string;
  issuedById: string;
  conditionOnIssue: 'NEW' | 'GOOD' | 'WORN' | 'RETIRED';
  notes?: string;
}

export interface BulkIssueClothingInput {
  employeeId: string;
  clothingItemIds: string[];
  issuedById: string;
  conditionOnIssue: 'NEW' | 'GOOD' | 'WORN' | 'RETIRED';
  notes?: string;
}

export interface ReturnClothingInput {
  transactionId: string;
  returnedById: string;
  conditionOnReturn: 'NEW' | 'GOOD' | 'WORN' | 'RETIRED';
  notes?: string;
}

export interface BulkReturnClothingInput {
  transactionIds: string[];
  returnedById: string;
  conditionOnReturn: 'NEW' | 'GOOD' | 'WORN' | 'RETIRED';
  notes?: string;
}

export interface BulkReturnClothingIndividualInput {
  items: Array<{
    transactionId: string;
    conditionOnReturn: 'NEW' | 'GOOD' | 'WORN' | 'RETIRED';
    notes?: string;
  }>;
  returnedById: string;
  generalNotes?: string;
}

export class TransactionService {
  /**
   * Issue multiple clothing items to employee (bulk operation)
   */
  async issueBulkClothing(input: BulkIssueClothingInput) {
    try {
      // Verify employee exists
      const employee = await prisma.employee.findUnique({
        where: { id: input.employeeId },
      });

      if (!employee || employee.status !== 'ACTIVE') {
        throw new Error('Employee not found or inactive');
      }

      // Verify issuer exists
      const issuer = await prisma.employee.findUnique({
        where: { id: input.issuedById },
      });

      if (!issuer) {
        throw new Error('Issuer not found');
      }

      // Verify all items exist and are available
      const clothingItems = await prisma.clothingItem.findMany({
        where: { id: { in: input.clothingItemIds } },
        include: { type: true },
      });

      if (clothingItems.length !== input.clothingItemIds.length) {
        throw new Error('One or more clothing items not found');
      }

      const unavailableItems = clothingItems.filter((item) => item.status !== 'AVAILABLE');
      if (unavailableItems.length > 0) {
        throw new Error(
          `Some items are not available: ${unavailableItems.map((i) => i.internalId).join(', ')}`
        );
      }

      // Create all transactions atomically
      const transactions = await prisma.$transaction(
        input.clothingItemIds.map((itemId) =>
          prisma.transaction.create({
            data: {
              employeeId: input.employeeId,
              clothingItemId: itemId,
              type: 'ISSUE',
              issuedById: input.issuedById,
              conditionOnIssue: input.conditionOnIssue,
              notes: input.notes,
            },
            include: {
              employee: true,
              clothingItem: {
                include: { type: true },
              },
              issuedBy: true,
            },
          })
        )
      );

      // Update all items status to PENDING (awaiting confirmation)
      await prisma.$transaction(
        input.clothingItemIds.map((itemId) =>
          prisma.clothingItem.update({
            where: { id: itemId },
            data: { 
              status: 'PENDING',
              currentEmployeeId: input.employeeId,
            },
          })
        )
      );

      logger.info(`Bulk issued ${transactions.length} items to employee ${input.employeeId}`);

      return transactions;
    } catch (error: any) {
      logger.error('Error in bulk issue clothing:', error);
      throw error;
    }
  }

  /**
   * Issue clothing to employee
   */
  async issueClothing(input: IssueClothingInput) {
    try {
      // Verify employee exists
      const employee = await prisma.employee.findUnique({
        where: { id: input.employeeId },
      });

      if (!employee || employee.status !== 'ACTIVE') {
        throw new Error('Employee not found or inactive');
      }

      // Verify clothing item exists and is available
      const clothingItem = await prisma.clothingItem.findUnique({
        where: { id: input.clothingItemId },
      });

      if (!clothingItem) {
        throw new Error('Clothing item not found');
      }

      if (clothingItem.status !== 'AVAILABLE') {
        throw new Error(`Clothing item is not available (current status: ${clothingItem.status})`);
      }

      // Verify issuer exists
      const issuer = await prisma.employee.findUnique({
        where: { id: input.issuedById },
      });

      if (!issuer) {
        throw new Error('Issuer not found');
      }

      // Create transaction and update clothing item in a transaction
      const transaction = await prisma.$transaction(async (tx) => {
        // Create transaction record
        const txRecord = await tx.transaction.create({
          data: {
            employeeId: input.employeeId,
            clothingItemId: input.clothingItemId,
            type: 'ISSUE',
            issuedById: input.issuedById,
            conditionOnIssue: input.conditionOnIssue,
            issuedAt: new Date(),
            notes: input.notes || null,
          },
          include: {
            employee: true,
            clothingItem: {
              include: {
                type: true,
              },
            },
            issuedBy: true,
          },
        });

        // Update clothing item status to PENDING (awaiting confirmation)
        await tx.clothingItem.update({
          where: { id: input.clothingItemId },
          data: {
            status: 'PENDING',
            currentEmployeeId: input.employeeId,
          },
        });

        return txRecord;
      });

      logger.info(`Issued clothing item ${clothingItem.internalId} to employee ${employee.email}`);
      return transaction;
    } catch (error) {
      logger.error('Error issuing clothing:', error);
      throw error;
    }
  }

  /**
   * Return multiple clothing items from employee (bulk operation)
   */
  async returnBulkClothing(input: BulkReturnClothingInput) {
    try {
      // Verify returner exists
      const returner = await prisma.employee.findUnique({
        where: { id: input.returnedById },
      });

      if (!returner) {
        throw new Error('Returner not found');
      }

      // Verify all transactions exist and are not already returned
      const transactions = await prisma.transaction.findMany({
        where: { id: { in: input.transactionIds } },
        include: {
          clothingItem: true,
          employee: true,
        },
      });

      if (transactions.length !== input.transactionIds.length) {
        throw new Error('One or more transactions not found');
      }

      const alreadyReturned = transactions.filter((t) => t.returnedAt !== null);
      if (alreadyReturned.length > 0) {
        throw new Error(
          `Some items are already returned: ${alreadyReturned.map((t) => t.clothingItem.internalId).join(', ')}`
        );
      }

      // Update all transactions and clothing items atomically
      const updatedTransactions = await prisma.$transaction(async (tx) => {
        const results = [];

        for (const transaction of transactions) {
          // Update transaction record
          const txRecord = await tx.transaction.update({
            where: { id: transaction.id },
            data: {
              returnedAt: new Date(),
              returnedById: input.returnedById,
              conditionOnReturn: input.conditionOnReturn,
              notes: input.notes
                ? transaction.notes
                  ? `${transaction.notes}\n---\nReturn: ${input.notes}`
                  : `Return: ${input.notes}`
                : transaction.notes,
            },
            include: {
              employee: true,
              clothingItem: {
                include: {
                  type: true,
                },
              },
              issuedBy: true,
              returnedBy: true,
            },
          });

          // Update clothing item status and condition
          await tx.clothingItem.update({
            where: { id: transaction.clothingItemId },
            data: {
              status: 'AVAILABLE',
              condition: input.conditionOnReturn,
              currentEmployeeId: null,
            },
          });

          results.push(txRecord);
        }

        return results;
      });

      logger.info(`Bulk returned ${updatedTransactions.length} items from employee`);
      return updatedTransactions;
    } catch (error: any) {
      logger.error('Error in bulk return clothing:', error);
      throw error;
    }
  }

  /**
   * Return multiple clothing items from employee with individual condition assessment
   */
  async returnBulkClothingIndividual(input: BulkReturnClothingIndividualInput) {
    try {
      // Verify returner exists
      const returner = await prisma.employee.findUnique({
        where: { id: input.returnedById },
      });

      if (!returner) {
        throw new Error('Returner not found');
      }

      // Extract transaction IDs from items
      const transactionIds = input.items.map(item => item.transactionId);

      // Verify all transactions exist and are not already returned
      const transactions = await prisma.transaction.findMany({
        where: { id: { in: transactionIds } },
        include: {
          clothingItem: true,
          employee: true,
        },
      });

      if (transactions.length !== transactionIds.length) {
        throw new Error('One or more transactions not found');
      }

      const alreadyReturned = transactions.filter((t) => t.returnedAt !== null);
      if (alreadyReturned.length > 0) {
        throw new Error(
          `Some items are already returned: ${alreadyReturned.map((t) => t.clothingItem.internalId).join(', ')}`
        );
      }

      // Create a map for quick lookup of item-specific data
      const itemDataMap = new Map();
      input.items.forEach(item => {
        itemDataMap.set(item.transactionId, item);
      });

      // Update all transactions and clothing items atomically
      const updatedTransactions = await prisma.$transaction(async (tx) => {
        const results = [];

        for (const transaction of transactions) {
          const itemData = itemDataMap.get(transaction.id);
          
          if (!itemData) {
            throw new Error(`Item data not found for transaction ${transaction.id}`);
          }

          // Prepare notes - combine transaction notes with general notes and item-specific notes
          let updatedNotes = transaction.notes;
          
          if (input.generalNotes) {
            updatedNotes = updatedNotes 
              ? `${updatedNotes}\n---\nReturn (General): ${input.generalNotes}`
              : `Return (General): ${input.generalNotes}`;
          }
          
          if (itemData.notes) {
            updatedNotes = updatedNotes
              ? `${updatedNotes}\n---\nReturn (Item): ${itemData.notes}`
              : `Return (Item): ${itemData.notes}`;
          }

          // Update transaction record with individual condition
          const txRecord = await tx.transaction.update({
            where: { id: transaction.id },
            data: {
              returnedAt: new Date(),
              returnedById: input.returnedById,
              conditionOnReturn: itemData.conditionOnReturn,
              notes: updatedNotes,
            },
            include: {
              employee: true,
              clothingItem: {
                include: {
                  type: true,
                },
              },
              issuedBy: true,
              returnedBy: true,
            },
          });

          // Update clothing item status and condition with individual assessment
          await tx.clothingItem.update({
            where: { id: transaction.clothingItemId },
            data: {
              status: 'AVAILABLE',
              condition: itemData.conditionOnReturn,
              currentEmployeeId: null,
            },
          });

          results.push(txRecord);
        }

        return results;
      });

      logger.info(`Bulk returned ${updatedTransactions.length} items with individual condition assessment`);
      return updatedTransactions;
    } catch (error: any) {
      logger.error('Error in bulk return clothing with individual assessment:', error);
      throw error;
    }
  }

  /**
   * Return clothing from employee
   */
  async returnClothing(input: ReturnClothingInput) {
    try {
      // Verify transaction exists and is not already returned
      const transaction = await prisma.transaction.findUnique({
        where: { id: input.transactionId },
        include: {
          clothingItem: true,
          employee: true,
        },
      });

      if (!transaction) {
        throw new Error('Transaction not found');
      }

      if (transaction.returnedAt) {
        throw new Error('Clothing item already returned');
      }

      // Verify returner exists
      const returner = await prisma.employee.findUnique({
        where: { id: input.returnedById },
      });

      if (!returner) {
        throw new Error('Returner not found');
      }

      // Update transaction and clothing item
      const updatedTransaction = await prisma.$transaction(async (tx) => {
        // Update transaction record
        const txRecord = await tx.transaction.update({
          where: { id: input.transactionId },
          data: {
            returnedAt: new Date(),
            returnedById: input.returnedById,
            conditionOnReturn: input.conditionOnReturn,
            notes: input.notes
              ? transaction.notes
                ? `${transaction.notes}\n---\nReturn: ${input.notes}`
                : `Return: ${input.notes}`
              : transaction.notes,
          },
          include: {
            employee: true,
            clothingItem: {
              include: {
                type: true,
              },
            },
            issuedBy: true,
            returnedBy: true,
          },
        });

        // Update clothing item status and condition
        await tx.clothingItem.update({
          where: { id: transaction.clothingItemId },
          data: {
            status: 'AVAILABLE',
            condition: input.conditionOnReturn,
            currentEmployeeId: null,
          },
        });

        return txRecord;
      });

      logger.info(
        `Returned clothing item ${transaction.clothingItem.internalId} from employee ${transaction.employee.email}`
      );
      return updatedTransaction;
    } catch (error) {
      logger.error('Error returning clothing:', error);
      throw error;
    }
  }

  /**
   * Get all transactions with optional filtering
   * For READ_ONLY users: only return transactions where they are the employee
   */
  async getAllTransactions(filters?: {
    employeeId?: string;
    clothingItemId?: string;
    type?: string;
    returned?: boolean;
    requestingUserId?: string; // For READ_ONLY filtering
    requestingUserRole?: string; // For READ_ONLY filtering
  }) {
    try {
      const where: any = {};

      if (filters?.employeeId) where.employeeId = filters.employeeId;
      if (filters?.clothingItemId) where.clothingItemId = filters.clothingItemId;
      if (filters?.type) where.type = filters.type;
      if (typeof filters?.returned === 'boolean') {
        where.returnedAt = filters.returned ? { not: null } : null;
      }

      // READ_ONLY users can only see their own transactions
      if (filters?.requestingUserRole === 'READ_ONLY' && filters?.requestingUserId) {
        where.employeeId = filters.requestingUserId;
      }

      const transactions = await prisma.transaction.findMany({
        where,
        include: {
          employee: true,
          clothingItem: {
            include: {
              type: true,
            },
          },
          issuedBy: true,
          returnedBy: true,
        },
        orderBy: { issuedAt: 'desc' },
      });

      logger.info(`Retrieved ${transactions.length} transactions`);
      return transactions;
    } catch (error) {
      logger.error('Error fetching transactions:', error);
      throw new Error('Failed to fetch transactions');
    }
  }

  /**
   * Get single transaction by ID
   */
  async getTransactionById(id: string) {
    try {
      const transaction = await prisma.transaction.findUnique({
        where: { id },
        include: {
          employee: true,
          clothingItem: {
            include: {
              type: true,
            },
          },
          issuedBy: true,
          returnedBy: true,
        },
      });

      if (!transaction) {
        throw new Error('Transaction not found');
      }

      return transaction;
    } catch (error) {
      logger.error('Error fetching transaction:', error);
      throw error;
    }
  }

  /**
   * Get pending returns (issued but not returned)
   */
  /**
   * Get pending returns
   * For READ_ONLY users: only return pending returns where they are the employee
   */
  async getPendingReturns(filters?: {
    requestingUserId?: string; // For READ_ONLY filtering
    requestingUserRole?: string; // For READ_ONLY filtering
  }) {
    try {
      const where: any = {
        returnedAt: null,
        type: 'ISSUE',
      };

      // READ_ONLY users can only see their own pending returns
      if (filters?.requestingUserRole === 'READ_ONLY' && filters?.requestingUserId) {
        where.employeeId = filters.requestingUserId;
      }

      const pendingReturns = await prisma.transaction.findMany({
        where,
        include: {
          employee: true,
          clothingItem: {
            include: {
              type: true,
            },
          },
          issuedBy: true,
        },
        orderBy: { issuedAt: 'desc' },
      });

      return pendingReturns;
    } catch (error) {
      logger.error('Error fetching pending returns:', error);
      throw error;
    }
  }

  /**
   * Get pending issues (clothing items with PENDING status awaiting confirmation)
   * For READ_ONLY users: only return pending issues where they are the employee
   */
  async getPendingIssues(filters?: {
    requestingUserId?: string; // For READ_ONLY filtering
    requestingUserRole?: string; // For READ_ONLY filtering
  }) {
    try {
      const where: any = {
        type: 'ISSUE',
        clothingItem: {
          status: 'PENDING'
        }
      };

      // READ_ONLY users can only see their own pending issues
      if (filters?.requestingUserRole === 'READ_ONLY' && filters?.requestingUserId) {
        where.employeeId = filters.requestingUserId;
      }

      const pendingIssues = await prisma.transaction.findMany({
        where,
        include: {
          employee: true,
          clothingItem: {
            include: {
              type: true,
            },
          },
          issuedBy: true,
        },
        orderBy: { issuedAt: 'desc' },
      });

      return pendingIssues;
    } catch (error) {
      logger.error('Error fetching pending issues:', error);
      throw error;
    }
  }

  /**
   * Get statistics
   */
  /**
   * Get transaction statistics
   * For READ_ONLY users: only count their own transactions
   */
  async getTransactionStats(filters?: {
    requestingUserId?: string; // For READ_ONLY filtering
    requestingUserRole?: string; // For READ_ONLY filtering
  }) {
    try {
      const where: any = {};

      // READ_ONLY users can only see their own transactions
      if (filters?.requestingUserRole === 'READ_ONLY' && filters?.requestingUserId) {
        where.employeeId = filters.requestingUserId;
      }

      const total = await prisma.transaction.count({ where });
      const issued = await prisma.transaction.count({ where: { ...where, type: 'ISSUE' } });
      const pendingReturns = await prisma.transaction.count({
        where: { ...where, returnedAt: null, type: 'ISSUE' },
      });
      const returned = await prisma.transaction.count({ where: { ...where, returnedAt: { not: null } } });

      const recentTransactions = await prisma.transaction.findMany({
        where,
        take: 10,
        orderBy: { issuedAt: 'desc' },
        include: {
          employee: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
          clothingItem: {
            include: {
              type: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      });

      return {
        total,
        issued,
        pendingReturns,
        returned,
        recentTransactions,
      };
    } catch (error) {
      logger.error('Error getting transaction stats:', error);
      throw error;
    }
  }
}

export const transactionService = new TransactionService();
