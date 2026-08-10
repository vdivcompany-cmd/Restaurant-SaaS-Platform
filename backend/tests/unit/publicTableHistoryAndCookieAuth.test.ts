import { describe, it, expect, beforeEach, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import { authMiddleware, optionalAuthMiddleware } from '../../src/middleware/auth.middleware.js';
import env from '../../src/config/env.js';

describe('Cookie Auth Middleware & Optional Auth', () => {
  const mockTenantId = '650000000000000000000001';
  const mockUserId = '650000000000000000000002';
  const validToken = jwt.sign(
    { userId: mockUserId, tenantId: mockTenantId, role: 'manager', email: 'manager@test.com' },
    env.JWT_SECRET
  );

  it('should authenticate user via access_token cookie when authorization header is missing', async () => {
    const req: any = {
      headers: {},
      cookies: { access_token: validToken },
    };
    const res: any = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    const next = vi.fn();

    await authMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toBeDefined();
    expect(req.user.id).toBe(mockUserId);
    expect(req.user.tenantId).toBe(mockTenantId);
  });

  it('should allow unauthenticated access through optionalAuthMiddleware without setting req.user', async () => {
    const req: any = {
      headers: {},
      cookies: {},
    };
    const res: any = {};
    const next = vi.fn();

    await optionalAuthMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toBeUndefined();
  });
});
