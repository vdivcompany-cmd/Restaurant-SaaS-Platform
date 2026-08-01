import type { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger.js';

/**
 * High-performance HTTP Request Telemetry Middleware for Serverless execution.
 * Captures route execution time in milliseconds and outputs structured logs.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const { method, url } = req;
  const tenantId = req.tenantId || req.body?.tenantSlug || req.query?.tenantSlug || 'public';

  // Attach completion listener to response stream
  res.on('finish', () => {
    const duration = Date.now() - start;
    const statusCode = res.statusCode;

    const logPayload = {
      method,
      url,
      statusCode,
      durationMs: duration,
      tenant: tenantId,
    };

    if (statusCode >= 500) {
      logger.error(logPayload, 'HTTP Server Error');
    } else if (statusCode >= 400) {
      logger.warn(logPayload, 'HTTP Client Error');
    } else {
      logger.debug(logPayload, 'HTTP Request Completed');
    }
  });

  next();
}
