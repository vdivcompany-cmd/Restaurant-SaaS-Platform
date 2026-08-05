import { queueService } from '../../services/queue/index.js';
import { PLATFORM_QUEUES } from '../../services/queue/queue-definitions.js';
import logger from '../../utils/logger.js';
import type { VectorSyncJobPayload } from '../../workers/vector-sync.worker.js';

/**
 * Fire-and-forget enqueue for vector sync jobs.
 * Never throws — mutations to Mongo must not fail because sync couldn't be queued.
 * QStash handles retries; if enqueue itself fails, we log and move on so the API
 * response isn't blocked. A periodic reconcile job (future) can catch drift.
 */
export async function enqueueVectorSync(payload: VectorSyncJobPayload): Promise<void> {
  try {
    await queueService.enqueue(PLATFORM_QUEUES.VECTOR_SYNC.name, payload, {
      tenantId: payload.tenantId,
    });
  } catch (err) {
    logger.error({ err, payload }, 'Failed to enqueue vector sync — vector store may drift');
  }
}
