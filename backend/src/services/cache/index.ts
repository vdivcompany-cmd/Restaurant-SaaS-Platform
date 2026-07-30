import type { ICacheService } from './cache.interface.js';
import { RedisCacheService } from './redis-cache.service.js';
import { MemoryCacheService } from './memory-cache.service.js';
import env from '../../config/env.js';

export * from './cache.interface.js';
export * from './redis-cache.service.js';
export * from './memory-cache.service.js';

let cacheInstance: ICacheService;

if (env.NODE_ENV === 'test') {
  cacheInstance = new MemoryCacheService();
} else {
  cacheInstance = new RedisCacheService();
}

export const cacheService: ICacheService = cacheInstance;
