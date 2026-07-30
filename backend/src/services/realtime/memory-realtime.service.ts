import type { IRealtimeService } from './realtime.interface.js';

export class MemoryRealtimeService implements IRealtimeService {
  public store = new Map<string, Record<string, unknown>>();

  public getTenantPath(tenantId: string, collection: string, docId: string): string {
    if (!tenantId || !collection || !docId) {
      throw new Error('Invalid path generation arguments: tenantId, collection, and docId are required');
    }
    return `restaurants/${tenantId}/${collection}/${docId}`;
  }

  public async publish(path: string, data: Record<string, unknown>): Promise<void> {
    const existing = this.store.get(path) ?? {};
    this.store.set(path, { ...existing, ...data, _updatedAt: new Date().toISOString() });
  }

  public async delete(path: string): Promise<void> {
    this.store.delete(path);
  }

  public clear(): void {
    this.store.clear();
  }
}
