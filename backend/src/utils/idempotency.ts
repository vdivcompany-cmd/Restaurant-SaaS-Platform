import { type Request, type Response, type NextFunction } from 'express';
import { cacheService } from '../services/cache/index.js';
import logger from './logger.js';

const IDEMPOTENCY_KEY_HEADER = 'Idempotency-Key';
const IDEMPOTENCY_TTL_SECONDS = 86_400; // 24 hours

/**
 * Idempotency middleware for payment and webhook endpoints.
 *
 * How it works:
 *   1. Client sends a request with a unique `Idempotency-Key` header.
 *   2. On first request: process normally, cache the response via CacheService for 24h.
 *   3. On duplicate request (same key): return the cached response immediately
 *      without re-processing — safe for retries.
 *
 * Use on: POST /payments/*, POST /webhooks/*
 * Do NOT use on: GET endpoints (they are already idempotent by nature).
 *
 * The key is namespaced by tenantId to prevent cross-tenant key collisions.
 */
export function idempotencyMiddleware() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const idempotencyKey = req.headers[IDEMPOTENCY_KEY_HEADER.toLowerCase()] as string | undefined;

    if (!idempotencyKey) {
      next();
      return;
    }

    const tenantId = (req as Request & { tenantId?: string }).tenantId ?? 'global';
    const cacheKey = `idempotency:${tenantId}:${idempotencyKey}`;

    try {
      const cached = await cacheService.get<string>(cacheKey);

      if (cached) {
        // Return the cached response — do not re-process
        const cachedResponse = JSON.parse(cached) as {
          statusCode: number;
          body: unknown;
        };
        logger.debug({ idempotencyKey, cacheKey }, 'Idempotency hit — returning cached response');
        res.status(cachedResponse.statusCode).json(cachedResponse.body);
        return;
      }

      // Intercept the response to cache it after processing
      const originalJson = res.json.bind(res);
      res.json = (body: unknown) => {
        // Only cache successful responses (2xx)
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const toCache = JSON.stringify({ statusCode: res.statusCode, body });
          cacheService
            .set(cacheKey, toCache, IDEMPOTENCY_TTL_SECONDS)
            .catch((err: unknown) => logger.error({ err, cacheKey }, 'Failed to cache idempotency key'));
        }
        return originalJson(body);
      };

      next();
    } catch (err) {
      // Idempotency check failure must not block the request — log and continue
      logger.error({ err, idempotencyKey }, 'Idempotency middleware error — processing request anyway');
      next();
    }
  };
}
