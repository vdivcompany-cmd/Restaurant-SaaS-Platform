import { queueService, PLATFORM_QUEUES } from '../services/queue/index.js';
import logger from '../utils/logger.js';
import { connectDatabase } from '../config/database.js';

export interface SubscriptionCheckJobPayload {
  tenantId: string;
  subscriptionId: string;
  checkType: 'expiry_warning' | 'grace_period' | 'cancel_expired';
}

export async function processSubscriptionCheckJob(payload: SubscriptionCheckJobPayload, headers?: Record<string, unknown>): Promise<void> {
  const tenantId = (headers?.['x-tenant-id'] as string) || payload.tenantId;
  logger.info({ tenantId, subscriptionId: payload.subscriptionId, checkType: payload.checkType }, 'Processing subscription check job');

  // Subscription verification logic
}

async function startSubscriptionWorker() {
  try {
    await connectDatabase();
    await queueService.assertQueues();

    logger.info(`Starting Subscription Check worker consuming queue: ${PLATFORM_QUEUES.SUBSCRIPTION_CHECKS.name}`);
    await queueService.consume<SubscriptionCheckJobPayload>(PLATFORM_QUEUES.SUBSCRIPTION_CHECKS.name, async (payload, headers) => {
      await processSubscriptionCheckJob(payload, headers);
    });
  } catch (error) {
    logger.error({ error }, 'Fatal error starting Subscription Check Worker');
  }
}

if (process.env['NODE_ENV'] !== 'test') {
  startSubscriptionWorker();
}
