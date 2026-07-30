import type { Request, Response, NextFunction } from 'express';
import type { UserRole } from '../shared/types/express.js';

/**
 * RBAC Middleware factory
 * Requires user to have one of the specified roles AND verifies tenant scoping consistency.
 */
export function rbacMiddleware(allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    // Platform Super Admin bypasses regular restaurant role boundaries and tenant checks
    if (req.user.role === 'super_admin') {
      next();
      return;
    }

    // Role check
    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: `Insufficient permissions. Required role: [${allowedRoles.join(', ')}]`,
      });
      return;
    }

    // Tenant consistency check: user's tenantId must match req.tenantId (if resolved)
    if (req.tenantId && req.user.tenantId !== req.tenantId) {
      res.status(403).json({
        success: false,
        message: 'Cross-tenant access attempt blocked',
      });
      return;
    }

    next();
  };
}

/**
 * Middleware restricting endpoint access strictly to platform Super Admins.
 */
export function requireSuperAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Authentication required' });
    return;
  }
  if (req.user.role !== 'super_admin') {
    res.status(403).json({ success: false, message: 'Access denied: Platform super admin authority required' });
    return;
  }
  next();
}
