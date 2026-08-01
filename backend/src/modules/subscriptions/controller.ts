import type { Request, Response, NextFunction } from 'express';
import { SubscriptionService } from './service.js';
import { UpdateSubscriptionSchema } from './validation.js';

export class SubscriptionController {
  public static async getSubscription(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.tenantId) {
        res.status(400).json({ success: false, message: 'Tenant context required' });
        return;
      }
      const subscription = await SubscriptionService.getSubscription(req.tenantId);
      res.json({ success: true, data: subscription });
    } catch (err) {
      next(err);
    }
  }

  public static async updateSubscription(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = UpdateSubscriptionSchema.parse(req.body);
      const subscription = await SubscriptionService.updateSubscription(validated.tenantId, validated);
      res.json({ success: true, data: subscription });
    } catch (err) {
      next(err);
    }
  }
}
