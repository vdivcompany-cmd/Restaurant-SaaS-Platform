import { describe, it, expect } from 'vitest';
import { RedisCacheService, MemoryCacheService } from '../../src/services/cache/index.js';
import { QStashQueueService, MemoryQueueService, PLATFORM_QUEUES } from '../../src/services/queue/index.js';
import { FirestoreRealtimeService, MemoryRealtimeService } from '../../src/services/realtime/index.js';

describe('Phase 2 — Real Service Interfaces & In-Memory Twins Suite', () => {
  describe('1. Cache Service & Distributed Locks', () => {
    it('RedisCacheService: should acquire and release distributed table locks atomically', async () => {
      const service = new RedisCacheService();
      const lockKey = `test_tenant_${Date.now()}:table_4`;

      // Acquire lock for 15 seconds
      const acquired = await service.acquireLock(lockKey, 15);
      expect(acquired).toBe(true);

      // Concurrent acquisition attempt should be rejected
      const duplicate = await service.acquireLock(lockKey, 15);
      expect(duplicate).toBe(false);

      // Release and verify re-acquisition
      await service.releaseLock(lockKey);
      const reAcquired = await service.acquireLock(lockKey, 15);
      expect(reAcquired).toBe(true);

      await service.del(`lock:${lockKey}`);
    });

    it('RedisCacheService: should handle incr and expire counters for distributed rate limiting', async () => {
      const service = new RedisCacheService();
      const counterKey = `test_rate_${Date.now()}`;

      const count1 = await service.incr(counterKey);
      const count2 = await service.incr(counterKey);
      expect(count1).toBe(1);
      expect(count2).toBe(2);

      await service.expire(counterKey, 5);
      expect(await service.exists(counterKey)).toBe(true);

      await service.del(counterKey);
      expect(await service.exists(counterKey)).toBe(false);
    });

    it('MemoryCacheService: should mimic distributed locks and counters in unit tests', async () => {
      const mem = new MemoryCacheService();
      expect(await mem.acquireLock('table_1', 10)).toBe(true);
      expect(await mem.acquireLock('table_1', 10)).toBe(false);
      await mem.releaseLock('table_1');
      expect(await mem.acquireLock('table_1', 10)).toBe(true);
      expect(await mem.incr('visits')).toBe(1);
      mem.clear();
    });
  });

  describe('2. Queue Service & DLQ Architecture', () => {
    it('QStashQueueService: should assert queues (no-op) and publish jobs without throwing', async () => {
      const qstash = new QStashQueueService();
      await qstash.assertQueues();

      // enqueue returns true/false depending on QStash reachability, but should not throw
      const sent = await qstash.enqueue(
        PLATFORM_QUEUES.INVOICES.name,
        { invoiceId: 'inv_4455', amount: 850, currency: 'EGP' },
        { tenantId: 'tenant_egypt_01' }
      );

      expect(typeof sent).toBe('boolean');
    });

    it('MemoryQueueService: should capture enqueued tasks synchronously for test verification', async () => {
      const memQueue = new MemoryQueueService();
      await memQueue.assertQueues();
      await memQueue.enqueue('test.queue', { sample: true }, { tenantId: 'test' });

      expect(memQueue.messages).toHaveLength(1);
      expect(memQueue.messages[0].queueName).toBe('test.queue');
      expect(memQueue.messages[0].options?.tenantId).toBe('test');
      memQueue.clear();
      expect(memQueue.messages).toHaveLength(0);
    });
  });

  describe('3. Realtime Projections Service (Firestore)', () => {
    it('FirestoreRealtimeService: should generate strict namespace paths and publish UI document to Firebase', async () => {
      const fsRealtime = new FirestoreRealtimeService();
      const path = fsRealtime.getTenantPath('tenant_test_cairo', 'orders', 'order_9900');
      expect(path).toBe('restaurants/tenant_test_cairo/orders/order_9900');

      await fsRealtime.publish(path, { status: 'READY_FOR_PICKUP', table: 'Table 12' });
      await fsRealtime.delete(path);
    });

    it('MemoryRealtimeService: should maintain projection documents in memory for instant verification', async () => {
      const memRealtime = new MemoryRealtimeService();
      const path = memRealtime.getTenantPath('tenant_demo', 'menu_projections', 'item_burger');
      await memRealtime.publish(path, { name: 'Cheese Burger', price: 150 });

      expect(memRealtime.store.has(path)).toBe(true);
      expect(memRealtime.store.get(path)?.name).toBe('Cheese Burger');
      await memRealtime.delete(path);
      expect(memRealtime.store.has(path)).toBe(false);
    });

    it('should reject invalid tenant path generation parameters', () => {
      const memRealtime = new MemoryRealtimeService();
      expect(() => memRealtime.getTenantPath('', 'orders', 'order_1')).toThrow();
      expect(() => memRealtime.getTenantPath('tenant_A', '', 'order_1')).toThrow();
      expect(() => memRealtime.getTenantPath('tenant_A', 'orders', '')).toThrow();
    });
  });
});
