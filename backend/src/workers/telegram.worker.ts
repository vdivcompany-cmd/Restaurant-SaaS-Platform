import { queueService, PLATFORM_QUEUES } from '../services/queue/index.js';
import logger from '../utils/logger.js';
import { connectDatabase } from '../config/database.js';

export interface TelegramJobPayload {
  chatId: string | number;
  message: string;
  orderId?: string;
  tenantId?: string;
}

export async function processTelegramJob(payload: TelegramJobPayload, headers?: Record<string, unknown>): Promise<void> {
  const tenantId = (headers?.['x-tenant-id'] as string) || payload.tenantId || 'global';
  logger.info({ tenantId, chatId: payload.chatId, orderId: payload.orderId }, 'Processing Telegram message job');

  // Telegram Bot API dispatch logic
}

async function startTelegramWorker() {
  try {
    await connectDatabase();
    await queueService.assertQueues();

    logger.info(`Starting Telegram worker consuming queue: ${PLATFORM_QUEUES.TELEGRAM.name}`);
    await queueService.consume<TelegramJobPayload>(PLATFORM_QUEUES.TELEGRAM.name, async (payload, headers) => {
      await processTelegramJob(payload, headers);
    });
  } catch (error) {
    logger.error({ error }, 'Fatal error starting Telegram Worker');
  }
}

if (process.env['NODE_ENV'] !== 'test') {
  startTelegramWorker();
}
