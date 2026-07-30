export interface ICacheService {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;

  // Distributed Locking for concurrency control (e.g., table checkout, bill generation)
  acquireLock(key: string, ttlSeconds: number): Promise<boolean>;
  releaseLock(key: string): Promise<void>;

  // Counters and explicit TTL management for rate limiting & metrics
  incr(key: string): Promise<number>;
  expire(key: string, ttlSeconds: number): Promise<void>;
}
