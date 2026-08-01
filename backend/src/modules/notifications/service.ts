import { Types } from 'mongoose';
import { queueService, PLATFORM_QUEUES } from '../../services/queue/index.js';
import { NotificationRepository } from './repository.js';
import { type SendNotificationDto } from './validation.js';

export class NotificationService {
  public async dispatchNotification(
    tenantId: string,
    dto: SendNotificationDto,
    actionMakerId?: string | any
  ): Promise<{ logId: string; success: boolean }> {
    const targetQueue =
      dto.channel === 'EMAIL'
        ? (PLATFORM_QUEUES['EMAILS']?.name ?? 'q.emails')
        : (PLATFORM_QUEUES['TELEGRAM']?.name ?? 'q.telegram');

    // Create audit log entry
    const log = await NotificationRepository.createLog({
      tenantId: new Types.ObjectId(tenantId),
      channel: dto.channel as 'EMAIL' | 'TELEGRAM' | 'SMS' | 'WHATSAPP',
      recipient: dto.recipient,
      messageSubject: dto.subject,
      messageBody: dto.message,
      status: 'QUEUED',
      branchId: dto.branchId ? new Types.ObjectId(dto.branchId) : undefined,
      tableNumber: dto.tableNumber,
      actionMakerId: actionMakerId ? new Types.ObjectId(actionMakerId) : undefined,
      dispatchedAt: new Date(),
    } as any);

    // Enqueue for actual delivery
    const success = await queueService.enqueue(
      targetQueue,
      {
        logId: log._id.toString(),
        recipient: dto.recipient,
        message: dto.message,
        subject: dto.subject,
        dispatchedAt: new Date(),
      },
      { tenantId }
    );

    return { logId: log._id.toString(), success };
  }
}
