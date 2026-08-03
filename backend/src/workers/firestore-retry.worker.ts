import { realtimeService } from '../services/realtime/index.js';
import logger from '../utils/logger.js';

interface FirestoreRetryPayload {
  path: string;
  data: Record<string, unknown>;
  failedAt: string;
}

/**
 * Job handler for q.firestore-retry.
 *
 * Triggered when FirestoreRealtimeService.publishSafe() catches a write failure
 * and enqueues a retry job to protect MongoDB-first integrity (PROJECT_RULES Rule #3).
 *
 * On success: Firestore projection is brought back in sync with MongoDB.
 * On failure: Throws error so QStash can evaluate retry limits.
 */
export async function processFirestoreRetryJob(
  payload: FirestoreRetryPayload,
  headers?: Record<string, unknown>,
): Promise<void> {
  const tenantId = (headers?.['x-tenant-id'] as string) ?? 'unknown';
  const { path, data, failedAt } = payload;

  logger.info({ path, tenantId, failedAt }, 'Retrying Firestore projection write from retry queue');

  // Re-attempt the Firestore write using the standard publish() path.
  await realtimeService.publish(path, data);

  logger.info({ path, tenantId }, 'Firestore retry write succeeded — projection restored');
}
