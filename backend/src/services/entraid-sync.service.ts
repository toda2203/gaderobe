import { Client } from '@microsoft/microsoft-graph-client';
import 'isomorphic-fetch';
import prisma from '../utils/database';
import logger from '../utils/logger';
import { config } from '../config';
import * as msal from '@azure/msal-node';

/**
 * Service to sync employees from Entra ID (Azure AD) to local database
 */
export class EntraIdSyncService {
  private graphClient: Client | null = null;

  /**
   * Initialize Graph API client with app credentials
   */
  private async initializeGraphClient(): Promise<Client> {
    try {
      const msalConfig = {
        auth: {
          clientId: config.azure.clientId,
          authority: `https://login.microsoftonline.com/${config.azure.tenantId}`,
          clientSecret: config.azure.clientSecret,
        },
      };

      const cca = new msal.ConfidentialClientApplication(msalConfig);
      const tokenRequest = {
        scopes: ['https://graph.microsoft.com/.default'],
      };

      this.graphClient = Client.init({
        authProvider: async (done) => {
          try {
            const response = await cca.acquireTokenByClientCredential(tokenRequest);
            if (!response?.accessToken) {
              throw new Error('Failed to acquire access token');
            }
            done(null, response.accessToken);
          } catch (error) {
            done(error as Error, null);
          }
        },
      });

      return this.graphClient;
    } catch (error) {
      logger.error('Failed to initialize Graph Client:', error);
      throw error;
    }
  }

  /**
   * Fetch all users from Entra ID
   */
  async fetchUsersFromEntraId(): Promise<any[]> {
    try {
      const client = await this.initializeGraphClient();

      const allUsers: any[] = [];
      let page = 0;

      let result = await client
        .api('/users')
        .filter("accountEnabled eq true")
        .select(['id', 'userPrincipalName', 'givenName', 'surname', 'mail', 'jobTitle', 'department', 'employeeId'])
        .top(999)
        .get();

      page += 1;
      allUsers.push(...(result.value || []));
      logger.info(`Fetched ${result.value?.length || 0} users from Entra ID (page ${page})`);

      let nextLink = result['@odata.nextLink'];
      while (nextLink) {
        result = await client.api(nextLink).get();
        page += 1;
        allUsers.push(...(result.value || []));
        logger.info(`Fetched ${result.value?.length || 0} users from Entra ID (page ${page})`);
        nextLink = result['@odata.nextLink'];
      }

      logger.info(`Fetched total ${allUsers.length} users from Entra ID`);
      return allUsers;
    } catch (error: any) {
      if (error.statusCode === 403 || error.code === 'Authorization_RequestDenied') {
        logger.warn('Entra ID sync skipped: Insufficient permissions. Please configure Microsoft Graph permissions in Azure Portal.');
        logger.warn('Required permission: User.Read.All on Microsoft Graph');
        return [];
      }
      logger.error('Error fetching users from Entra ID:', error);
      throw error;
    }
  }

  /**
   * Sync users from Entra ID to database
   */
  async syncUsersFromEntraId(): Promise<{ created: number; updated: number; deleted: number }> {
    try {
      logger.info('Starting Entra ID sync...');

      // Fetch users from Entra ID
      const entraUsers = await this.fetchUsersFromEntraId();

      if (!entraUsers || entraUsers.length === 0) {
        logger.warn('No users found in Entra ID or sync skipped due to permissions');
        return { created: 0, updated: 0, deleted: 0 };
      }

      let created = 0;
      let updated = 0;

      // Process each Entra user
      for (const entraUser of entraUsers) {
        try {
          const email = entraUser.mail || entraUser.userPrincipalName;
          const firstName = entraUser.givenName || 'Unknown';
          const lastName = entraUser.surname || 'User';
          const department = entraUser.department || 'Not Assigned';
          const employeeId = entraUser.employeeId || entraUser.id;
          const entraId = entraUser.id; // required by schema

          // Check if employee exists
          const existingEmployee = await prisma.employee.findFirst({
            where: { OR: [{ email }, { entraId }] },
          });

          if (existingEmployee) {
            // Update existing employee
            await prisma.employee.update({
              where: { id: existingEmployee.id },
              data: {
                firstName,
                lastName,
                department,
                entraId,
                status: 'ACTIVE', // Re-activate if they're in Entra and enabled
              },
            });

            updated++;
            logger.info(`Updated employee: ${email}`);
          } else {
            // Create new employee
            await prisma.employee.create({
              data: {
                firstName,
                lastName,
                email,
                department,
                entraId,
                status: 'ACTIVE',
                role: 'READ_ONLY', // Default role
              },
            });

            created++;
            logger.info(`Created employee: ${email}`);
          }
        } catch (error) {
          logger.error(`Error processing user ${entraUser.mail}:`, error);
          // Continue with next user
        }
      }

      // Mark employees as INACTIVE if they're no longer in Entra ID
      const deleted = await this.markRemovedEmployeesAsInactive(entraUsers);

      logger.info(
        `Entra ID sync completed: Created: ${created}, Updated: ${updated}, Marked Inactive: ${deleted}`
      );

      return { created, updated, deleted };
    } catch (error) {
      logger.error('Error during Entra ID sync:', error);
      throw error;
    }
  }

  /**
   * Mark employees as INACTIVE if they're no longer in Entra ID
   */
  private async markRemovedEmployeesAsInactive(entraUsers: any[]): Promise<number> {
    try {
      const entraIds = entraUsers
        .map((u) => u.id)
        .filter((id) => id);

      const entraEmails = entraUsers
        .map((u) => u.mail || u.userPrincipalName)
        .filter((email) => email)
        .map((email) => String(email).toLowerCase());

      const activeEmployees = await prisma.employee.findMany({
        where: { status: 'ACTIVE' },
      });

      let marked = 0;

      for (const employee of activeEmployees) {
        const email = String(employee.email).toLowerCase();
        const isMissingById = !entraIds.includes(employee.entraId);
        const isMissingByEmail = !entraEmails.includes(email);

        if (isMissingById && isMissingByEmail) {
          await prisma.employee.update({
            where: { id: employee.id },
            data: { status: 'INACTIVE' },
          });

          marked++;
          logger.info(`Marked as inactive: ${employee.email}`);
        }
      }

      return marked;
    } catch (error) {
      logger.error('Error marking removed employees as inactive:', error);
      return 0;
    }
  }

  /**
   * Get sync status
   */
  async getSyncStatus(): Promise<{
    lastSync: Date | null;
    totalEmployees: number;
    activeEmployees: number;
    inactiveEmployees: number;
  }> {
    try {
      const total = await prisma.employee.count();
      const active = await prisma.employee.count({ where: { status: 'ACTIVE' } });
      const inactive = await prisma.employee.count({ where: { status: 'INACTIVE' } });

      return {
        lastSync: new Date(), // In production, store this in database
        totalEmployees: total,
        activeEmployees: active,
        inactiveEmployees: inactive,
      };
    } catch (error) {
      logger.error('Error getting sync status:', error);
      throw error;
    }
  }
}

export const entraIdSyncService = new EntraIdSyncService();
