import type { Request, Response, NextFunction } from 'express';
import { TenantService } from './service.js';
import { CreateTenantSchema, UpdateTenantSettingsSchema, RestaurantProfileSchema } from './validation.js';

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
      if (req.user?.role !== 'super_admin' && req.tenantId && paramId && paramId !== req.tenantId) {
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
      if (req.user?.role !== 'super_admin' && req.tenantId && paramId && paramId !== req.tenantId) {
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

  public static async upsertProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.tenantId ?? '';
      const validated = RestaurantProfileSchema.parse(req.body);
      const profile = await TenantService.upsertProfile(tenantId, validated);
      const data = {
        ...profile.toObject(),
        currency: profile.settings?.currency || 'EGP',
      };
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  public static async getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.tenantId ?? '';
      const profile = await TenantService.getProfile(tenantId);
      const data = {
        ...profile.toObject(),
        currency: profile.settings?.currency || 'EGP',
      };
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  public static async getAiStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rawTenantId = req.params['tenantId'] || req.tenantId || '';
      const tenantId = Array.isArray(rawTenantId) ? String(rawTenantId[0]) : String(rawTenantId);
      const status = await TenantService.getAiStatus(tenantId);
      res.status(200).json({ success: true, data: status });
    } catch (err) {
      next(err);
    }
  }
}
