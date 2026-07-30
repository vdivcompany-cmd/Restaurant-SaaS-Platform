import type { Request, Response, NextFunction } from 'express';
import { TenantService } from './service.js';
import { CreateTenantSchema, UpdateTenantSettingsSchema } from './validation.js';

export class TenantController {
  public static async createTenant(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = CreateTenantSchema.parse(req.body);
      const tenant = await TenantService.createTenant(validated);
      res.status(201).json({
        success: true,
        data: tenant,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async getTenant(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const paramId = typeof req.params['id'] === 'string' ? req.params['id'] : undefined;
      if (req.tenantId && paramId && paramId !== req.tenantId) {
        res.status(403).json({ success: false, message: 'Cross-tenant access denied' });
        return;
      }
      const tenantId = paramId ?? req.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, message: 'Tenant ID required' });
        return;
      }
      const tenant = await TenantService.getTenantById(tenantId);
      res.json({
        success: true,
        data: tenant,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async updateSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const paramId = typeof req.params['id'] === 'string' ? req.params['id'] : undefined;
      if (req.tenantId && paramId && paramId !== req.tenantId) {
        res.status(403).json({ success: false, message: 'Cross-tenant access denied' });
        return;
      }
      const tenantId = paramId ?? req.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, message: 'Tenant ID required' });
        return;
      }
      const validated = UpdateTenantSettingsSchema.parse(req.body);
      const updated = await TenantService.updateTenantSettings(tenantId, validated);
      res.json({
        success: true,
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  }
}
