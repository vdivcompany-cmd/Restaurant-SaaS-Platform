import type { Request, Response, NextFunction } from 'express';
import { NotificationService } from './service.js';
import { NotificationRepository } from './repository.js';
import { sendNotificationSchema } from './validation.js';

const service = new NotificationService();

export async function dispatchNotificationHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.tenantId) {
      res.status(400).json({ success: false, message: 'Tenant context required' });
      return;
    }
    const validated = sendNotificationSchema.parse(req.body);
    const actionMakerId = req.user?.id;
    const result = await service.dispatchNotification(req.tenantId, validated, actionMakerId);
    res.status(200).json({
      success: result.success,
      data: { logId: result.logId },
      message: 'Notification enqueued for delivery',
    });
  } catch (err) {
    next(err);
  }
}

export async function listNotificationsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.tenantId) {
      res.status(400).json({ success: false, message: 'Tenant context required' });
      return;
    }
    const limit = typeof req.query['limit'] === 'string' ? parseInt(req.query['limit'], 10) : 50;
    const logs = await NotificationRepository.findByTenant(req.tenantId, limit);
    res.json({ success: true, data: logs });
  } catch (err) {
    next(err);
  }
}
