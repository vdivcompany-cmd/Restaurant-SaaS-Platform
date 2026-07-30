import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';

import env from './config/env.js';
import logger from './utils/logger.js';

/**
 * Creates and configures the Express application.
 *
 * This factory function is kept separate from server.ts so the app
 * can be imported by integration tests without actually binding to a port.
 *
 * Middleware order matters:
 *   security → logging → body parsing → routes → error handling
 */
export function createApp(): Express {
  const app = express();

  // ─── Security ─────────────────────────────────────────────────────────────
  app.use(
    helmet({
      // Allow cross-origin requests only from env-defined origins
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.use(
    cors({
      // CORS origins come from env — never hardcode domains
      origin: env.NODE_ENV === 'production'
        ? (process.env['CORS_ORIGIN'] ?? '').split(',').map((o) => o.trim()).filter(Boolean)
        : true, // allow all in development
      credentials: true,
    }),
  );

  // ─── Request Logging ──────────────────────────────────────────────────────
  app.use(
    pinoHttp({
      logger,
      // Don't log health check noise
      autoLogging: {
        ignore: (req) => ['/health', '/ready', '/live'].includes(req.url ?? ''),
      },
    }),
  );

  // ─── Parsing ──────────────────────────────────────────────────────────────
  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Trust proxy — required when behind Nginx on Hostinger VPS
  app.set('trust proxy', 1);

  // ─── Health Checks ────────────────────────────────────────────────────────
  // These are wired up before auth middleware so monitoring tools
  // can reach them unauthenticated.
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.get('/ready', (_req, res) => {
    // Phase 6 will expand this with actual dependency checks (DB, Redis, etc.)
    res.json({ status: 'ready', timestamp: new Date().toISOString() });
  });

  app.get('/live', (_req, res) => {
    res.json({ status: 'live', timestamp: new Date().toISOString() });
  });

  // ─── API Routes ───────────────────────────────────────────────────────────
  // Route modules are registered here in Phase 1+.
  // Example: app.use('/api/v1/auth', authRouter);

  // ─── 404 Handler ──────────────────────────────────────────────────────────
  app.use((_req, res) => {
    res.status(404).json({ success: false, message: 'Route not found' });
  });

  return app;
}
