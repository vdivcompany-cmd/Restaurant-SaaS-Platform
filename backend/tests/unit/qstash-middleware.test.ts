import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { qstashVerifyMiddleware } from '../../src/middleware/qstash.middleware.js';

describe('QStash Middleware Unit Tests', () => {
  it('should return 401 if upstash-signature header is missing', async () => {
    const req = {
      headers: {},
    } as unknown as Request;

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;

    const next = vi.fn() as NextFunction;

    await qstashVerifyMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Missing QStash signature' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 500 if raw body is not captured', async () => {
    const req = {
      headers: { 'upstash-signature': 'fake-sig' },
    } as unknown as Request;

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;

    const next = vi.fn() as NextFunction;

    await qstashVerifyMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Raw body not captured for signature verification',
    });
    expect(next).not.toHaveBeenCalled();
  });
});
