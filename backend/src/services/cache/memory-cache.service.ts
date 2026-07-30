import type { ICacheService } from './cache.interface.js';

interface CacheItem {
  value: unknown;
  expiresAt?: number;
}

export class MemoryCacheService implements ICacheService {
  private store = new Map<string, CacheItem>();

  public async get<T>(key: string): Promise<T | null> {
    const item = this.store.get(key);
    if (!item) return null;

    if (item.expiresAt !== undefined && Date.now() > item.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return item.value as T;
  }

  public async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const item: CacheItem = { value };
    if (ttlSeconds && ttlSeconds > 0) {
      item.expiresAt = Date.now() + ttlSeconds * 1000;
    }
    this.store.set(key, item);
  }

  public async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  public async exists(key: string): Promise<boolean> {
    const val = await this.get(key);
    return val !== null;
  }

  public clear(): void {
    this.store.clear();
  }
}
