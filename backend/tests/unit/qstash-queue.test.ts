import { describe, it, expect } from 'vitest';
import { QStashQueueService } from '../../src/services/queue/qstash-queue.service.js';

describe('QStashQueueService Unit Tests', () => {
  it('should throw on consume() because QStash is push-based', async () => {
    const queue = new QStashQueueService();
    await expect(queue.consume('q.emails', async () => {})).rejects.toThrow(
      'QStashQueueService.consume() is not supported'
    );
  });

  it('should not throw on assertQueues()', async () => {
    const queue = new QStashQueueService();
    await expect(queue.assertQueues()).resolves.toBeUndefined();
  });
});
