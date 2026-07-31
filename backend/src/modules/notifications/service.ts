import { queueService, PLATFORM_QUEUES } from '../../services/queue/index.js';
import { type SendNotificationDto } from './validation.js';

export class NotificationService {
  public async dispatchNotification(tenantId: string, dto: SendNotificationDto): Promise<boolean> {
    const targetQueue =
      dto.channel === 'EMAIL'
        ? (PLATFORM_QUEUES['EMAILS']?.name ?? 'q.emails')
        : (PLATFORM_QUEUES['TELEGRAM']?.name ?? 'q.telegram');
    return await queueService.enqueue(
      targetQueue,
      {
        recipient: dto.recipient,
        message: dto.message,
        dispatchedAt: new Date(),
      },
      { tenantId },
    );
  }
}
