import type { Request, Response, NextFunction } from 'express';
import { TenantRepository } from '../modules/tenants/repository.js';

/**
 * Tenant Middleware
 * Resolves tenantId either from authenticated user's token OR from bot/channel header (X-Tenant-Slug).
 * Enforces room isolation by attaching req.tenantId.
 *
 * All DB access goes through TenantRepository (Rule: never touch models directly from middleware).
 */
export async function tenantMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // 1. Dashboard / Authenticated user path
    if (req.user?.tenantId) {
      req.tenantId = req.user.tenantId;
      return next();
    }

    // 2. Bot / Channel / Webhook context path via X-Tenant-Slug
    const tenantSlug = req.headers['x-tenant-slug'] as string | undefined;
    if (tenantSlug) {
      const tenant = await TenantRepository.findBySlug(tenantSlug);
      if (!tenant) {
        res.status(403).json({ success: false, message: 'Invalid tenant slug in header' });
        return;
      }
      if (tenant.status === 'suspended') {
        res.status(403).json({ success: false, message: 'Tenant account is suspended' });
        return;
      }
      req.tenantId = tenant._id.toString();
      return next();
    }

    // 3. Fallback — check x-tenant-id header (verified against database)
    const tenantIdHeader = req.headers['x-tenant-id'] as string | undefined;
    if (tenantIdHeader) {
      const tenant = await TenantRepository.findById(tenantIdHeader);
      if (!tenant) {
        res.status(403).json({ success: false, message: 'Invalid tenant ID in header' });
        return;
      }
      if (tenant.status === 'suspended') {
        res.status(403).json({ success: false, message: 'Tenant account is suspended' });
        return;
      }
      req.tenantId = tenant._id.toString();
      return next();
    }

    res.status(403).json({
      success: false,
      message: 'Tenant context could not be resolved. Access denied.',
    });
  } catch (err) {
    next(err);
  }
}
