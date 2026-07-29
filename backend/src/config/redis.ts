import { Redis } from '@upstash/redis';
import env from './env.js';
import logger from '../utils/logger.js';

/**
 * Upstash Redis client (REST-based).
 *
 * Upstash Redis uses an HTTP REST API instead of a TCP socket connection.
 * This means:
 *   - No persistent TCP connection to manage or close
 *   - Works behind serverless/edge environments
 *   - TLS is built-in (HTTPS)
 *   - No connect/disconnect lifecycle needed
 *
 * Business logic must never import this directly — it must go through
 * CacheService (Phase 2). This file is used only by:
 *   - CacheService implementation (services/cache/redis-cache.service.ts)
 *   - The connectivity verification script (scripts/verify-connections.ts)
 *
 * Credentials: UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
 * from your Upstash console → Redis database → REST API section.
 */
let _client: Redis | null = null;

export function getRedisClient(): Redis {
  if (_client) return _client;

  _client = new Redis({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  });

  logger.info('Upstash Redis client initialized');
  return _client;
}

/**
 * No-op for Upstash REST client — no persistent connection to close.
 * Kept for API compatibility with server.ts shutdown sequence.
 */
export async function disconnectRedis(): Promise<void> {
  _client = null;
  logger.info('Upstash Redis client released');
}
