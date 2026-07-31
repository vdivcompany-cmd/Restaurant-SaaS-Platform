import { NotificationLogModel, type INotificationLog } from './model.js';
import { tenantQuery } from '../../utils/tenantQuery.js';

export class NotificationRepository {
  public static async createLog(data: Partial<INotificationLog>): Promise<INotificationLog> {
    const log = new NotificationLogModel(data);
    return await log.save();
  }

  public static async findByTenant(tenantId: string, limit: number = 50): Promise<INotificationLog[]> {
    return await tenantQuery.find(NotificationLogModel, tenantId)
      .sort({ dispatchedAt: -1 })
      .limit(limit)
      .exec();
  }

  public static async updateStatus(id: string, status: 'SENT' | 'FAILED', errorMessage?: string): Promise<INotificationLog | null> {
    return await NotificationLogModel.findByIdAndUpdate(
      id,
      { status, errorMessage, dispatchedAt: new Date() },
      { new: true }
    ).exec();
  }
}
