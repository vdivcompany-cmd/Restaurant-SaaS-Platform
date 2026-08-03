import 'dotenv/config';
import http from 'http';

import env from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { getRedisClient, disconnectRedis } from './config/redis.js';
import { initFirebase } from './config/firebase.js';
import { createApp } from './app.js';
import logger from './utils/logger.js';

/**
 * Application entry point.
 *
 * Boot order:
 *   1. Validate environment variables (env.ts throws on misconfiguration)
 *   2. Connect MongoDB
 *   3. Initialize Redis (Upstash REST — synchronous, no async connect)
 *   4. Initialize Firebase Admin SDK
 *   5. Start HTTP server
 *
 * Shutdown order (SIGTERM / SIGINT):
 *   1. Stop accepting new connections (server.close)
 *   2. Close MongoDB connection
 *   3. Release Redis client
 */

async function bootstrap(): Promise<void> {
  logger.info(`Starting Restaurant SaaS API — NODE_ENV=${env.NODE_ENV}`);

  // ── 1. Database connections ────────────────────────────────────────────────
  await connectDatabase();
  getRedisClient(); // Upstash REST client — synchronous init, no async connect needed

  // ── 2. Firebase ───────────────────────────────────────────────────────────
  // Skip Firebase init in test environment to avoid requiring credentials
  if (env.NODE_ENV !== 'test') {
    try {
      initFirebase();
    } catch (err) {
      logger.warn(
        { err },
        'Firebase initialization skipped — credentials not configured. ' +
          'Realtime features will be unavailable.',
      );
    }
  }

  // ── 3. HTTP server ────────────────────────────────────────────────────────
  const app = createApp();
  const server = http.createServer(app);

  server.listen(env.PORT, () => {
    logger.info(`HTTP server listening on port ${env.PORT}`);
  });

  // ── 4. Graceful shutdown ──────────────────────────────────────────────────
  async function shutdown(signal: string): Promise<void> {
    logger.info(`Received ${signal} — starting graceful shutdown`);

    // Stop accepting new connections; let in-flight requests finish
    server.close(async () => {
      try {
        await disconnectDatabase();
        await disconnectRedis();
        logger.info('Graceful shutdown complete');
        process.exit(0);
      } catch (err) {
        logger.error({ err }, 'Error during graceful shutdown');
        process.exit(1);
      }
    });

    // Force exit after 15 s if graceful shutdown stalls
    setTimeout(() => {
      logger.error('Graceful shutdown timed out — forcing exit');
      process.exit(1);
    }, 15_000);
  }

  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.once('SIGINT', () => void shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, 'Unhandled promise rejection — exiting');
    process.exit(1);
  });
}

bootstrap().catch((err) => {
  console.error('Fatal error during bootstrap:', err);
  process.exit(1);
});
