import type { Request, Response, NextFunction } from 'express';
import { NotificationService, sendNotificationSchema } from './service.js';

const service = new NotificationService();

export async function dispatchNotificationHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.tenantId ?? '';
    const validated = sendNotificationSchema.parse(req.body);
    const success = await service.dispatchNotification(tenantId, validated);
    res.status(200).json({ success, message: 'Notification enqueued for delivery' });
  } catch (err) {
    next(err);
  }
}
