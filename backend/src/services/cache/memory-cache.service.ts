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

  public async acquireLock(key: string, ttlSeconds: number): Promise<boolean> {
    const lockKey = `lock:${key}`;
    const existing = await this.get(lockKey);
    if (existing !== null) {
      return false;
    }
    await this.set(lockKey, 'LOCKED', ttlSeconds);
    return true;
  }

  public async releaseLock(key: string): Promise<void> {
    await this.del(`lock:${key}`);
  }

  public async incr(key: string): Promise<number> {
    const val = (await this.get<number>(key)) ?? 0;
    const next = val + 1;
    await this.set(key, next);
    return next;
  }

  public async expire(key: string, ttlSeconds: number): Promise<void> {
    const item = this.store.get(key);
    if (item && ttlSeconds > 0) {
      item.expiresAt = Date.now() + ttlSeconds * 1000;
      this.store.set(key, item);
    }
  }

  public clear(): void {
    this.store.clear();
  }
}
