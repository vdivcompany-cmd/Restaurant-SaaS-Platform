import { queueService, PLATFORM_QUEUES } from '../../services/queue/index.js';
import { z } from 'zod';

export const sendNotificationSchema = z.object({
  channel: z.enum(['EMAIL', 'TELEGRAM']),
  recipient: z.string().min(1),
  message: z.string().min(1),
});

export type SendNotificationDto = z.infer<typeof sendNotificationSchema>;

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
