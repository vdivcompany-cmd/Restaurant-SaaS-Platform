import type { IQueueService } from './queue.interface.js';
import { QStashQueueService } from './qstash-queue.service.js';
import { MemoryQueueService } from './memory-queue.service.js';
import env from '../../config/env.js';

export * from './queue.interface.js';
export * from './queue-definitions.js';
export * from './qstash-queue.service.js';
export * from './memory-queue.service.js';

let queueInstance: IQueueService;

if (env.NODE_ENV === 'test') {
  queueInstance = new MemoryQueueService();
} else {
  queueInstance = new QStashQueueService();
}

export const queueService: IQueueService = queueInstance;
