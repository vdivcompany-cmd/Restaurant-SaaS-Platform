import type { Request, Response, NextFunction } from 'express';
import { BillingService } from './service.js';
import { CreateBillingRecordSchema } from './validation.js';

export class BillingController {
  public static async getRecords(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.tenantId) {
        res.status(400).json({ success: false, message: 'Tenant context required' });
        return;
      }
      const records = await BillingService.getRecords(req.tenantId);
      res.json({ success: true, data: records });
    } catch (err) {
      next(err);
    }
  }

  public static async getRecord(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.tenantId) {
        res.status(400).json({ success: false, message: 'Tenant context required' });
        return;
      }
      const id = typeof req.params['id'] === 'string' ? req.params['id'] : undefined;
      if (!id) {
        res.status(400).json({ success: false, message: 'Billing record ID required' });
        return;
      }
      const record = await BillingService.getRecordById(req.tenantId, id);
      res.json({ success: true, data: record });
    } catch (err) {
      next(err);
    }
  }

  public static async createRecord(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = CreateBillingRecordSchema.parse(req.body);
      const tenantId = req.tenantId ?? validated.tenantId;
      const record = await BillingService.createRecord(tenantId, validated);
      res.status(201).json({ success: true, data: record });
    } catch (err) {
      next(err);
    }
  }
}
