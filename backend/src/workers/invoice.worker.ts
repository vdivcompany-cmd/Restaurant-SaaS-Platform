import { queueService, PLATFORM_QUEUES } from '../services/queue/index.js';
import logger from '../utils/logger.js';
import { connectDatabase } from '../config/database.js';

export interface InvoiceJobPayload {
  tenantId: string;
  orderId?: string;
  subscriptionId?: string;
  amount: number;
  currency: string;
  paymentMethod: string;
}

export async function processInvoiceJob(payload: InvoiceJobPayload, headers?: Record<string, unknown>): Promise<void> {
  const tenantId = (headers?.['x-tenant-id'] as string) || payload.tenantId;
  logger.info({ tenantId, amount: payload.amount, method: payload.paymentMethod }, 'Processing invoice generation job');

  // Invoice generation logic
}

async function startInvoiceWorker() {
  try {
    await connectDatabase();
    await queueService.assertQueues();

    logger.info(`Starting Invoice worker consuming queue: ${PLATFORM_QUEUES.INVOICES.name}`);
    await queueService.consume<InvoiceJobPayload>(PLATFORM_QUEUES.INVOICES.name, async (payload, headers) => {
      await processInvoiceJob(payload, headers);
    });
  } catch (error) {
    logger.error({ error }, 'Fatal error starting Invoice Worker');
  }
}

if (process.env['NODE_ENV'] !== 'test') {
  startInvoiceWorker();
}
