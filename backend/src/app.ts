import express, { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import { config } from './config';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { requestLogger } from './middleware/logging.middleware';
import { rateLimiter } from './middleware/rate-limit.middleware';

// Routes
import authRoutes from './routes/auth.routes';
import employeeRoutes from './routes/employee.routes';
import clothingRoutes from './routes/clothing.routes';
import clothingTypeRoutes from './routes/clothing-type.routes';
import transactionRoutes from './routes/transaction.routes';
import reportRoutes from './routes/report.routes';
import healthRoutes from './routes/health.routes';
import syncRoutes from './routes/sync.routes';
import exportRoutes from './routes/export.routes';
import confirmationRoutes from './routes/confirmations';
import systemRoutes from './routes/system.routes';
import publicDataRoutes from './routes/public-data.routes';
import backupConfigRoutes from './routes/backup-config.routes';

const app: Application = express();

// ========================================
// Security & Performance Middleware
// ========================================
app.use(helmet());
app.use(
  cors({
    origin: config.corsOrigin as unknown as string[],
    credentials: true,
  })
);
app.use(compression());

// ========================================
// Request Parsing
// ========================================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ========================================
// Logging
// ========================================
if (config.env === 'development') {
  app.use(morgan('dev'));
}
app.use(requestLogger);

// ========================================
// Rate Limiting
// ========================================
app.use('/api/', rateLimiter);

// ========================================
// Static Files
// ========================================
app.use('/uploads', express.static(config.uploadDir));

// ========================================
// API Routes
// ========================================
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/public', publicDataRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/clothing-types', clothingTypeRoutes);
app.use('/api/clothing', clothingRoutes);
app.use('/api/clothing-items', clothingRoutes); // Alias for consistency
app.use('/api/transactions', transactionRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/confirmations', confirmationRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/backup-config', backupConfigRoutes);

// ========================================
// Error Handling
// ========================================
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
