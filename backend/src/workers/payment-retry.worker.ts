import { queueService, PLATFORM_QUEUES } from '../services/queue/index.js';
import logger from '../utils/logger.js';
import { connectDatabase } from '../config/database.js';

export interface PaymentRetryJobPayload {
  tenantId: string;
  invoiceId: string;
  attemptNumber: number;
}

export async function processPaymentRetryJob(payload: PaymentRetryJobPayload, headers?: Record<string, unknown>): Promise<void> {
  const tenantId = (headers?.['x-tenant-id'] as string) || payload.tenantId;
  logger.info({ tenantId, invoiceId: payload.invoiceId, attemptNumber: payload.attemptNumber }, 'Processing payment retry job');

  // Payment retry processing
}

async function startPaymentRetryWorker() {
  try {
    await connectDatabase();
    await queueService.assertQueues();

    logger.info(`Starting Payment Retry worker consuming queue: ${PLATFORM_QUEUES.PAYMENT_RETRIES.name}`);
    await queueService.consume<PaymentRetryJobPayload>(PLATFORM_QUEUES.PAYMENT_RETRIES.name, async (payload, headers) => {
      await processPaymentRetryJob(payload, headers);
    });
  } catch (error) {
    logger.error({ error }, 'Fatal error starting Payment Retry Worker');
  }
}

if (process.env['NODE_ENV'] !== 'test') {
  startPaymentRetryWorker();
}
