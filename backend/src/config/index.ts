import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
  // Server
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',

  // Database
  databaseUrl: process.env.DATABASE_URL || 'file:./data/bekleidung.db',

  // Azure AD / Microsoft Entra ID
  azure: {
    tenantId: process.env.AZURE_TENANT_ID || '',
    clientId: process.env.AZURE_CLIENT_ID || '',
    clientSecret: process.env.AZURE_CLIENT_SECRET || '',
    redirectUri: process.env.AZURE_REDIRECT_URI || 'http://localhost:3000/api/auth/callback',
    authority: process.env.AZURE_AUTHORITY || `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}`,
    scopes: ['User.Read', 'email', 'profile', 'openid'],
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  // CORS - Dynamische Host-Konfiguration
  corsOrigin: (() => {
    const appHost = process.env.APP_HOST || 'localhost';
    const frontendPort = process.env.FRONTEND_PORT || '3078';
    const backendPort = process.env.BACKEND_PORT || '3077';
    
    return [
      'http://localhost:3078',
      'http://localhost:3077',
      'https://localhost:3078',
      'https://localhost:3077',
      `http://${appHost}:${frontendPort}`,
      `https://${appHost}:${frontendPort}`,
      `http://${appHost}:${backendPort}`,
      `https://${appHost}:${backendPort}`,
      process.env.CORS_ORIGIN || 'http://localhost',
    ];
  })(),

  // File Upload
  uploadDir: path.resolve(process.env.UPLOAD_DIR || './uploads'),
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '5242880', 10), // 5MB
  allowedImageTypes: (process.env.ALLOWED_IMAGE_TYPES || 'image/jpeg,image/png,image/webp').split(','),

  // Backup
  backupDir: path.resolve(process.env.BACKUP_DIR || './backups'),
  backupRetentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS || '30', 10),

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',
  logDir: path.resolve(process.env.LOG_DIR || './logs'),

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10), // 1 minute
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '500', 10), // 500 requests per minute
  },

  // Session
  session: {
    secret: process.env.SESSION_SECRET || 'your-session-secret',
    cookieMaxAge: parseInt(process.env.SESSION_COOKIE_MAX_AGE || '86400000', 10), // 24h
  },

  // QR Code
  qrCode: {
    size: parseInt(process.env.QR_CODE_SIZE || '300', 10),
    errorCorrection: (process.env.QR_CODE_ERROR_CORRECTION || 'M') as 'L' | 'M' | 'Q' | 'H',
  },

  // Reports
  reportTempDir: path.resolve(process.env.REPORT_TEMP_DIR || './temp/reports'),
  reportRetentionHours: parseInt(process.env.REPORT_RETENTION_HOURS || '24', 10),
} as const;

// Validate required environment variables
const requiredEnvVars = ['AZURE_TENANT_ID', 'AZURE_CLIENT_ID', 'AZURE_CLIENT_SECRET', 'JWT_SECRET'];

if (config.env === 'production') {
  const missing = requiredEnvVars.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

export default config;
