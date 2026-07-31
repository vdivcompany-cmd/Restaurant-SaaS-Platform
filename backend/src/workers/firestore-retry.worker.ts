import { realtimeService } from '../services/realtime/index.js';
import { queueService, PLATFORM_QUEUES } from '../services/queue/index.js';
import logger from '../utils/logger.js';
import { connectDatabase } from '../config/database.js';

interface FirestoreRetryPayload {
  path: string;
  data: Record<string, unknown>;
  failedAt: string;
}

/**
 * Consumer for q.firestore-retry.
 *
 * Triggered when FirestoreRealtimeService.publishSafe() catches a write failure
 * and enqueues a retry job to protect MongoDB-first integrity (PROJECT_RULES Rule #3).
 *
 * On success: Firestore projection is brought back in sync with MongoDB.
 * On failure: Message is nacked (no requeue) and routed to q.firestore-retry.dlq
 *             after the broker's maxRetries limit is exhausted.
 */
export async function processFirestoreRetryJob(
  payload: FirestoreRetryPayload,
  headers?: Record<string, unknown>,
): Promise<void> {
  const tenantId = (headers?.['x-tenant-id'] as string) ?? 'unknown';
  const { path, data, failedAt } = payload;

  logger.info({ path, tenantId, failedAt }, 'Retrying Firestore projection write from retry queue');

  // Re-attempt the Firestore write using the standard publish() path.
  // If this also fails, the RabbitMQ broker will retry up to maxRetries=5
  // before routing to q.firestore-retry.dlq for manual inspection.
  await realtimeService.publish(path, data);

  logger.info({ path, tenantId }, 'Firestore retry write succeeded — projection restored');
}

async function startFirestoreRetryWorker() {
  try {
    await connectDatabase();
    await queueService.assertQueues();

    logger.info(`Starting Firestore Retry worker consuming queue: ${PLATFORM_QUEUES.FIRESTORE_RETRY.name}`);
    await queueService.consume<FirestoreRetryPayload>(
      PLATFORM_QUEUES.FIRESTORE_RETRY.name,
      async (payload, headers) => {
        await processFirestoreRetryJob(payload, headers);
      },
    );
  } catch (error) {
    logger.error({ error }, 'Fatal error starting Firestore Retry Worker');
  }
}

if (process.env['NODE_ENV'] !== 'test') {
  startFirestoreRetryWorker();
}
