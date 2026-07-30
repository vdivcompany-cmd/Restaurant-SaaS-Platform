import { queueService, PLATFORM_QUEUES } from '../services/queue/index.js';
import logger from '../utils/logger.js';
import { connectDatabase } from '../config/database.js';

export interface EmailJobPayload {
  to: string;
  subject: string;
  template: string;
  context: Record<string, unknown>;
  tenantId?: string;
}

export async function processEmailJob(payload: EmailJobPayload, headers?: Record<string, unknown>): Promise<void> {
  const tenantId = (headers?.['x-tenant-id'] as string) || payload.tenantId || 'global';
  logger.info({ tenantId, to: payload.to, subject: payload.subject }, 'Processing email delivery job');

  // Email processing logic (e.g. SMTP / Nodemailer dispatch)
  // Non-blocking asynchronous task execution
}

async function startEmailWorker() {
  try {
    await connectDatabase();
    await queueService.assertQueues();

    logger.info(`Starting email worker consuming queue: ${PLATFORM_QUEUES.EMAILS.name}`);
    await queueService.consume<EmailJobPayload>(PLATFORM_QUEUES.EMAILS.name, async (payload, headers) => {
      await processEmailJob(payload, headers);
    });
  } catch (error) {
    logger.error({ error }, 'Fatal error starting Email Worker');
  }
}

if (process.env['NODE_ENV'] !== 'test') {
  startEmailWorker();
}
