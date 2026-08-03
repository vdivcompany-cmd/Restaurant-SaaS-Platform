import type { Request, Response, NextFunction } from 'express';
import { TenantRepository } from '../modules/tenants/repository.js';

/**
 * Tenant Middleware
 * Resolves tenantId from authenticated user's token (primary) OR from body/query (for impersonation/public requests).
 * For POST/PUT/PATCH/DELETE: tenant context reads from req.body.tenantId / req.body.tenantSlug
 * For GET/other: tenant context reads from query params (?tenantId=... or ?tenantSlug=...)
 * Enforces room isolation by attaching req.tenantId.
 *
 * All DB access goes through TenantRepository (Rule: never touch models directly from middleware).
 */
export async function tenantMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // 1. Dashboard / Authenticated user path (JWT already carries tenantId — always wins)
    if (req.user) {
      if (req.user.role === 'super_admin') {
        // Allow Super Admin to impersonate via header (X-Target-Tenant-Id), body (for mutating), or query (for GET)
        const headerTenantId = (req.headers['x-target-tenant-id'] || req.headers['X-Target-Tenant-Id']) as string | undefined;
        const bodyTenantId = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)
          ? (req.body?.tenantId as string | undefined)
          : undefined;
        const bodyTenantSlug = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)
          ? (req.body?.tenantSlug as string | undefined)
          : undefined;
        const queryTenantId = req.query['tenantId'] as string | undefined;
        const queryTenantSlug = req.query['tenantSlug'] as string | undefined;

        const targetId = headerTenantId ?? bodyTenantId ?? queryTenantId;
        const targetSlug = bodyTenantSlug ?? queryTenantSlug;

        if (targetId) {
          const tenant = await TenantRepository.findById(targetId);
          if (tenant) {
            req.tenantId = tenant._id.toString();
            return next();
          }
        }
        if (targetSlug) {
          const tenant = await TenantRepository.findBySlug(targetSlug);
          if (tenant) {
            req.tenantId = tenant._id.toString();
            return next();
          }
        }
      }
      // Authenticated user's own tenant (primary path)
      if (req.user.tenantId) {
        req.tenantId = req.user.tenantId;
      }
      return next();
    }

    // 2. Public / Bot / Webhook / QR Scan context path (no authenticated user)
    const headerTenantId = (req.headers['x-tenant-id'] || req.headers['X-Tenant-Id'] || req.headers['x-target-tenant-id'] || req.headers['X-Target-Tenant-Id']) as string | undefined;
    const headerTenantSlug = (req.headers['x-tenant-slug'] || req.headers['X-Tenant-Slug']) as string | undefined;

    // For POST/PUT/PATCH/DELETE: read from body
    const bodyTenantId = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)
      ? (req.body?.tenantId as string | undefined)
      : undefined;
    const bodyTenantSlug = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)
      ? (req.body?.tenantSlug as string | undefined)
      : undefined;

    // For all requests: read from query as fallback
    const queryTenantId = req.query['tenantId'] as string | undefined;
    const queryTenantSlug = req.query['tenantSlug'] as string | undefined;

    const targetId = headerTenantId ?? bodyTenantId ?? queryTenantId;
    const targetSlug = headerTenantSlug ?? bodyTenantSlug ?? queryTenantSlug;

    if (targetId) {
      const tenant = await TenantRepository.findById(targetId);
      if (!tenant) {
        res.status(403).json({ success: false, message: 'Invalid tenant ID' });
        return;
      }
      if (tenant.status === 'suspended') {
        res.status(403).json({ success: false, message: 'Tenant account is suspended' });
        return;
      }
      req.tenantId = tenant._id.toString();
      return next();
    }

    if (targetSlug) {
      const tenant = await TenantRepository.findBySlug(targetSlug);
      if (!tenant) {
        res.status(403).json({ success: false, message: 'Invalid tenant slug' });
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
