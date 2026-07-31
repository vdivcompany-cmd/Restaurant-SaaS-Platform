import type { IRealtimeService } from './realtime.interface.js';
import { getFirestore, initFirebase } from '../../config/firebase.js';
import { queueService, PLATFORM_QUEUES } from '../queue/index.js';
import logger from '../../utils/logger.js';

export class FirestoreRealtimeService implements IRealtimeService {
  private get db() {
    try {
      return getFirestore();
    } catch {
      initFirebase();
      return getFirestore();
    }
  }

  public getTenantPath(tenantId: string, collection: string, docId: string): string {
    if (!tenantId || !collection || !docId) {
      throw new Error('Invalid path generation arguments: tenantId, collection, and docId are required');
    }
    return `restaurants/${tenantId}/${collection}/${docId}`;
  }

  public async publish(path: string, data: Record<string, unknown>): Promise<void> {
    // Use merge: true so partial projection updates do not overwrite untouched UI attributes
    await this.db.doc(path).set({ ...data, _updatedAt: new Date().toISOString() }, { merge: true });
  }

  public async publishSafe(path: string, data: Record<string, unknown>, tenantId?: string): Promise<void> {
    try {
      await this.publish(path, data);
    } catch (error: any) {
      logger.error(
        { path, tenantId, error: error?.message || error },
        'Firestore publish failed — enqueuing retry job per Rule #3',
      );
      try {
        await queueService.enqueue(
          PLATFORM_QUEUES.FIRESTORE_RETRY.name,
          { path, data, failedAt: new Date().toISOString() },
          { tenantId },
        );
      } catch (enqueueErr) {
        logger.error(
          { path, enqueueErr },
          'Fatal: Failed to enqueue Firestore retry job to RabbitMQ',
        );
      }
    }
  }

  public async delete(path: string): Promise<void> {
    await this.db.doc(path).delete();
  }
}
