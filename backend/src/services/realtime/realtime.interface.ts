export interface IRealtimeService {
  /** Generate enforced multi-tenant Firestore path: restaurants/{tenantId}/{collection}/{docId} */
  getTenantPath(tenantId: string, collection: string, docId: string): string;

  /** Publish or merge a JSON projection document to Firestore */
  publish(path: string, data: Record<string, unknown>): Promise<void>;

  /**
   * Publishes to Firestore. On failure, enqueues a retry job via QueueService
   * instead of throwing — ensuring MongoDB-first Rule #3 compliance.
   */
  publishSafe(path: string, data: Record<string, unknown>, tenantId?: string): Promise<void>;

  /** Remove projection when deleted or archived in primary MongoDB store */
  delete(path: string): Promise<void>;
}
