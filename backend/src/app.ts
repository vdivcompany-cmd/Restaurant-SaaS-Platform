import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';

import env from './config/env.js';
import logger from './utils/logger.js';
import { errorHandler } from './middleware/errorHandler.middleware.js';
import { authRateLimiter, apiRateLimiter } from './middleware/rateLimit.middleware.js';

import { healthService } from './health/health.service.js';

import authRoutes from './modules/auth/routes.js';
import tenantRoutes from './modules/tenants/routes.js';
import subscriptionRoutes from './modules/subscriptions/routes.js';
import billingRoutes from './modules/billing/routes.js';
import restaurantRoutes from './modules/restaurants/routes.js';
import branchRoutes from './modules/branches/routes.js';
import categoryRoutes from './modules/categories/routes.js';
import variantRoutes from './modules/variants/routes.js';
import productRoutes from './modules/products/routes.js';
import menuRoutes from './modules/menu/routes.js';
import tableRoutes from './modules/tables/routes.js';
import orderRoutes from './modules/orders/routes.js';
import couponRoutes from './modules/coupons/routes.js';
import customerRoutes from './modules/customers/routes.js';
import employeeRoutes from './modules/employees/routes.js';
import feedbackRoutes from './modules/feedback/routes.js';
import reportRoutes from './modules/reports/routes.js';
import notificationRoutes from './modules/notifications/routes.js';

/**
 * Creates and configures the Express application.
 *
 * Middleware order matters:
 *   security → logging → body parsing → rate-limiting → routes → error handling
 */
export function createApp(): Express {
  const app = express();

  // ─── Security ─────────────────────────────────────────────────────────────
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.use(
    cors({
      origin: env.NODE_ENV === 'production'
        ? (process.env['CORS_ORIGIN'] ?? '').split(',').map((o) => o.trim()).filter(Boolean)
        : true,
      credentials: true,
    }),
  );

  // ─── Request Logging ──────────────────────────────────────────────────────
  app.use(
    pinoHttp({
      logger,
      autoLogging: {
        ignore: (req) => ['/health', '/ready', '/live'].includes(req.url ?? ''),
      },
    }),
  );

  // ─── Parsing ──────────────────────────────────────────────────────────────
  app.use(compression());
  app.use(express.json({
    limit: '20mb',
    verify: (req: any, _res, buf) => {
      if (req.url?.includes('/webhook') || req.originalUrl?.includes('/webhook')) {
        req.rawBody = buf.toString('utf8');
      }
    }
  }));
  app.use(express.urlencoded({ extended: true, limit: '20mb' }));
  app.use(cookieParser());

  // Trust proxy — required when behind Nginx on Hostinger VPS
  app.set('trust proxy', 1);

  // ─── Health Checks ────────────────────────────────────────────────────────
  app.get('/health', (_req, res) => {
    res.json(healthService.getLiveness());
  });

  app.get('/live', (_req, res) => {
    res.json(healthService.getLiveness());
  });

  app.get('/ready', async (_req, res) => {
    const readiness = await healthService.getReadiness();
    const statusCode = readiness.status === 'ok' ? 200 : 503;
    res.status(statusCode).json(readiness);
  });

  // ─── Global API Rate Limiter ──────────────────────────────────────────────
  app.use('/api/', apiRateLimiter);

  // ─── API Routes ───────────────────────────────────────────────────────────
  app.use('/api/v1/auth', authRateLimiter, authRoutes);
  app.use('/api/v1/tenants', tenantRoutes);
  app.use('/api/v1/subscriptions', subscriptionRoutes);
  app.use('/api/v1/billing', billingRoutes);
  app.use('/api/v1/restaurants', restaurantRoutes);
  app.use('/api/v1/branches', branchRoutes);
  app.use('/api/v1/categories', categoryRoutes);
  app.use('/api/v1/variants', variantRoutes);
  app.use('/api/v1/products', productRoutes);
  app.use('/api/v1/menu', menuRoutes);
  app.use('/api/v1/tables', tableRoutes);
  app.use('/api/v1/orders', orderRoutes);
  app.use('/api/v1/coupons', couponRoutes);
  app.use('/api/v1/customers', customerRoutes);
  app.use('/api/v1/employees', employeeRoutes);
  app.use('/api/v1/feedback', feedbackRoutes);
  app.use('/api/v1/reports', reportRoutes);
  app.use('/api/v1/notifications', notificationRoutes);

  // ─── 404 Handler ──────────────────────────────────────────────────────────
  app.use((_req, res) => {
    res.status(404).json({ success: false, message: 'Route not found' });
  });

  // ─── Global Error Handler ─────────────────────────────────────────────────
  app.use(errorHandler);

  return app;
}
