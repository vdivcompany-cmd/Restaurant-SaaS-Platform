import rateLimit from 'express-rate-limit';
import env from '../config/env.js';

/**
 * Auth rate limiter — protects /login and /register from brute-force attacks.
 * 10 attempts per 15 minutes per IP. Stricter in production.
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: env.NODE_ENV === 'production' ? 10 : 100,
  standardHeaders: true,
  legacyHeaders: false,
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
  message: {
    success: false,
    message: 'Too many requests, please slow down.',
  },
  skip: () => env.NODE_ENV === 'test',
});
