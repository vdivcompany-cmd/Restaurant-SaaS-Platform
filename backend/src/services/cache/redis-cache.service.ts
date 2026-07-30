import type { ICacheService } from './cache.interface.js';
import { getRedisClient } from '../../config/redis.js';

export class RedisCacheService implements ICacheService {
  private get client() {
    return getRedisClient();
  }

  public async get<T>(key: string): Promise<T | null> {
    const data = await this.client.get<T>(key);
    return data ?? null;
  }

  public async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds && ttlSeconds > 0) {
      await this.client.set(key, value, { ex: ttlSeconds });
    } else {
      await this.client.set(key, value);
    }
  }

  public async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  public async exists(key: string): Promise<boolean> {
    const count = await this.client.exists(key);
    return count > 0;
  }

  public async acquireLock(key: string, ttlSeconds: number): Promise<boolean> {
    const lockKey = `lock:${key}`;
    const res = await this.client.set(lockKey, 'LOCKED', { ex: ttlSeconds, nx: true });
    return res !== null && res !== undefined;
  }

  public async releaseLock(key: string): Promise<void> {
    await this.client.del(`lock:${key}`);
  }

  public async incr(key: string): Promise<number> {
    return await this.client.incr(key);
  }

  public async expire(key: string, ttlSeconds: number): Promise<void> {
    await this.client.expire(key, ttlSeconds);
  }
}
