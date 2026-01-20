import { ConfidentialClientApplication, AuthorizationUrlRequest, AuthorizationCodeRequest } from '@azure/msal-node';
import { config } from '../config';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import prisma from '../utils/database';
import logger from '../utils/logger';

const msalConfig = {
  auth: {
    clientId: config.azure.clientId,
    authority: config.azure.authority,
    clientSecret: config.azure.clientSecret,
  },
};

const pca = new ConfidentialClientApplication(msalConfig);

// Cache for used authorization codes to prevent double redemption
const usedAuthCodes = new Map<string, { timestamp: number; result: any }>();
const AUTH_CODE_CACHE_TTL = 60000; // 1 minute

// Clean up old codes every minute
setInterval(() => {
  const now = Date.now();
  for (const [code, data] of usedAuthCodes.entries()) {
    if (now - data.timestamp > AUTH_CODE_CACHE_TTL) {
      usedAuthCodes.delete(code);
    }
  }
}, 60000);

export class AuthService {
  /**
   * Generate authorization URL for Microsoft login
   */
  async getAuthUrl(redirectUri: string): Promise<string> {
    const authCodeUrlParameters: AuthorizationUrlRequest = {
      scopes: [...config.azure.scopes],
      redirectUri: redirectUri || config.azure.redirectUri,
    };

    const authUrl = await pca.getAuthCodeUrl(authCodeUrlParameters);
    return authUrl;
  }

  /**
   * Exchange authorization code for access token and user info
   */
  async handleCallback(code: string, redirectUri: string) {
    try {
      // Check if this code was already used recently
      const cached = usedAuthCodes.get(code);
      if (cached) {
        logger.info('Returning cached auth result for already used code');
        return cached.result;
      }

      const tokenRequest: AuthorizationCodeRequest = {
        code,
        scopes: [...config.azure.scopes],
        redirectUri: redirectUri || config.azure.redirectUri,
      };

      const response = await pca.acquireTokenByCode(tokenRequest);

      if (!response) {
        throw new Error('Failed to acquire token');
      }

      // Get user info from Microsoft Graph
      const userInfo = await this.getUserInfoFromGraph(response.accessToken);

      // Create or update employee in database
      const employee = await this.syncEmployee(userInfo);

      // Generate JWT token for our application
      const token = this.generateToken(employee);
      const refreshToken = this.generateRefreshToken(employee);

      const result = {
        token,
        refreshToken,
        user: {
          id: employee.id,
          email: employee.email,
          firstName: employee.firstName,
          lastName: employee.lastName,
          department: employee.department,
          role: employee.role,
        },
      };

      // Cache the result for this code
      usedAuthCodes.set(code, { timestamp: Date.now(), result });

      return result;
    } catch (error) {
      logger.error('Auth callback error:', error);
      throw error;
    }
  }

  /**
   * Fetch user information from Microsoft Graph API
   */
  private async getUserInfoFromGraph(accessToken: string) {
    try {
      const response = await axios.get('https://graph.microsoft.com/v1.0/me', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      return {
        entraId: response.data.id,
        email: response.data.mail || response.data.userPrincipalName,
        firstName: response.data.givenName || '',
        lastName: response.data.surname || '',
        department: response.data.department || null,
      };
    } catch (error) {
      logger.error('Failed to fetch user info from Graph:', error);
      throw new Error('Failed to fetch user information');
    }
  }

  /**
   * Create or update employee from Entra ID data
   */
  private async syncEmployee(userInfo: any) {
    const employee = await prisma.employee.upsert({
      where: { entraId: userInfo.entraId },
      update: {
        email: userInfo.email,
        firstName: userInfo.firstName,
        lastName: userInfo.lastName,
        department: userInfo.department,
        lastSyncAt: new Date(),
      },
      create: {
        entraId: userInfo.entraId,
        email: userInfo.email,
        firstName: userInfo.firstName,
        lastName: userInfo.lastName,
        department: userInfo.department,
        status: 'ACTIVE',
        role: 'READ_ONLY', // Default role, can be changed by admin
      },
    });

    return employee;
  }

  /**
   * Sync all employees from Microsoft Entra ID
   */
  async syncAllEmployees(accessToken: string) {
    try {
      const response = await axios.get('https://graph.microsoft.com/v1.0/users', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        params: {
          $select: 'id,mail,userPrincipalName,givenName,surname,department',
          $top: 999,
        },
      });

      const users = response.data.value;
      const synced = [];

      for (const user of users) {
        if (!user.mail && !user.userPrincipalName) continue;

        const employee = await this.syncEmployee({
          entraId: user.id,
          email: user.mail || user.userPrincipalName,
          firstName: user.givenName || '',
          lastName: user.surname || '',
          department: user.department || null,
        });

        synced.push(employee);
      }

      logger.info(`Synced ${synced.length} employees from Entra ID`);
      return synced;
    } catch (error) {
      logger.error('Failed to sync employees:', error);
      throw error;
    }
  }

  /**
   * Generate JWT token for application authentication
   */
  private generateToken(employee: any): string {
    return jwt.sign(
      {
        userId: employee.id,
        email: employee.email,
        entraId: employee.entraId,
        role: employee.role,
      },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn } as any
    );
  }

  /**
   * Generate refresh token
   */
  private generateRefreshToken(employee: any): string {
    return jwt.sign(
      {
        userId: employee.id,
        email: employee.email,
        type: 'refresh',
      },
      config.jwt.secret,
      { expiresIn: config.jwt.refreshExpiresIn } as any
    );
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(refreshToken: string) {
    try {
      const decoded = jwt.verify(refreshToken, config.jwt.secret) as any;

      if (decoded.type !== 'refresh') {
        throw new Error('Invalid refresh token');
      }

      const employee = await prisma.employee.findUnique({
        where: { id: decoded.userId },
      });

      if (!employee || employee.status !== 'ACTIVE') {
        throw new Error('Employee not found or inactive');
      }

      const token = this.generateToken(employee);
      return { token };
    } catch (error) {
      logger.error('Token refresh error:', error);
      throw error;
    }
  }

  /**
   * Verify JWT token
   */
  verifyToken(token: string) {
    try {
      return jwt.verify(token, config.jwt.secret);
    } catch (error) {
      throw new Error('Invalid token');
    }
  }
}

export const authService = new AuthService();
