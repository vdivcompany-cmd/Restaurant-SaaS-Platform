import type { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import logger from '../utils/logger.js';
import { TenantScopeError } from '../utils/tenantQuery.js';

export class AppError extends Error {
  public statusCode: number;
  public details?: unknown;

  constructor(message: string, statusCode: number = 500, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    if (details !== undefined) {
      this.details = details;
    }
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler: ErrorRequestHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  if (err instanceof ZodError || err.name === 'ZodError') {
    const zodErr = err as ZodError;
    const issues = zodErr.issues || (zodErr as unknown as { errors: Array<{ path: (string | number)[]; message: string }> }).errors || [];
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: issues.map((e) => ({
        field: Array.isArray(e.path) ? e.path.join('.') : String(e.path),
        message: e.message,
      })),
    });
    return;
  }

  if (err instanceof TenantScopeError || err.name === 'TenantScopeError') {
    logger.warn({ err }, 'Tenant scope violation attempt');
    res.status(403).json({
      success: false,
      message: 'Access denied: Tenant scope mismatch or missing context',
    });
    return;
  }

  if (err instanceof AppError || ('statusCode' in err && typeof (err as AppError).statusCode === 'number')) {
    const appErr = err as AppError;
    res.status(appErr.statusCode || 500).json({
      success: false,
      message: appErr.message,
      ...(appErr.details !== undefined ? { details: appErr.details } : {}),
    });
    return;
  }

  // Handle Mongoose duplicate key error (11000)
  if ('code' in err && (err as { code?: number }).code === 11000) {
    res.status(409).json({
      success: false,
      message: 'Resource with given unique identifier already exists',
    });
    return;
  }

  logger.error({ err }, 'Unhandled application error');

  res.status(500).json({
    success: false,
    message: process.env['NODE_ENV'] === 'production' ? 'Internal server error' : err.message,
  });
};
