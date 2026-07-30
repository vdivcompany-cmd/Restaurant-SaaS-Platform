import dns from "dns"
dns.setServers(["8.8.8.8","8.8.4.4"])
import mongoose from 'mongoose';
import env from './env.js';
import logger from '../utils/logger.js';

/**
 * Connects to MongoDB using the URI from environment variables.
 *
 * Call once at startup (server.ts). Mongoose maintains a connection pool
 * internally — do not call this per-request.
 *
 * Compound indexes starting with `tenantId` are defined on each model
 * (Phase 1+). This config does not enforce that — it is a code-review rule.
 */
export async function connectDatabase(): Promise<void> {
  mongoose.connection.on('connected', () => {
    logger.info({ uri: redactUri(env.MONGODB_URI) }, 'MongoDB connected');
  });

  mongoose.connection.on('error', (err: Error) => {
    logger.error({ err }, 'MongoDB connection error');
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
  });

  await mongoose.connect(env.MONGODB_URI, {
    // Let Mongoose handle the connection pool.
    // Defaults: maxPoolSize=5, minPoolSize=0, serverSelectionTimeoutMS=30000
    serverSelectionTimeoutMS: 10_000,
    socketTimeoutMS: 45_000,
  });
}

/**
 * Gracefully closes the MongoDB connection.
 * Called on SIGTERM/SIGINT in server.ts.
 */
export async function disconnectDatabase(): Promise<void> {
  await mongoose.connection.close();
  logger.info('MongoDB connection closed gracefully');
}

/** Strips credentials from the URI for safe logging. */
function redactUri(uri: string): string {
  try {
    const parsed = new URL(uri);
    parsed.password = '***';
    parsed.username = parsed.username ? '***' : '';
    return parsed.toString();
  } catch {
    return '[invalid URI]';
  }
}
