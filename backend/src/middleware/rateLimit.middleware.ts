import rateLimit, { type Store, type ClientRateLimitInfo } from 'express-rate-limit';
import { cacheService } from '../services/cache/index.js';
import env from '../config/env.js';

/**
 * Custom distributed rate limit store backed by CacheService (Upstash Redis / Memory)
 * Ensures rate limits persist uniformly across PM2 worker clusters without violating Interface Rule #2.
 */
class CacheRateLimitStore implements Store {
  private windowSeconds: number;
  private keyPrefix: string;

  constructor(windowMs: number, keyPrefix: string = 'api') {
    this.windowSeconds = Math.ceil(windowMs / 1000);
    this.keyPrefix = keyPrefix;
  }

  public async increment(key: string): Promise<ClientRateLimitInfo> {
    const cacheKey = `ratelimit:${this.keyPrefix}:${key}`;
    const totalHits = await cacheService.incr(cacheKey);
    if (totalHits === 1) {
      await cacheService.expire(cacheKey, this.windowSeconds);
    }
    const resetTime = new Date(Date.now() + this.windowSeconds * 1000);
    return { totalHits, resetTime };
  }

  public async decrement(): Promise<void> {
    // Optional implementation for decrements
  }

  public async resetKey(key: string): Promise<void> {
    await cacheService.del(`ratelimit:${this.keyPrefix}:${key}`);
  }
}

/**
 * Auth rate limiter — protects /login and /register from brute-force attacks.
 * 10 attempts per 15 minutes per IP. Stricter in production.
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: env.NODE_ENV === 'production' ? 10 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  store: new CacheRateLimitStore(15 * 60 * 1000, 'auth'),
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again in 15 minutes.',
  },
  skip: () => env.NODE_ENV === 'test',
});

/**
 * General API rate limiter — broad protection for all API routes.
 * 200 requests per minute per IP.
 */
export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: env.NODE_ENV === 'production' ? 200 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  store: new CacheRateLimitStore(60 * 1000, 'api'),
  message: {
    success: false,
    message: 'Too many requests, please slow down.',
  },
  skip: (req) => env.NODE_ENV === 'test' || req.originalUrl.startsWith('/api/v1/auth'),
});

