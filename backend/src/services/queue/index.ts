import type { IQueueService } from './queue.interface.js';
import { RabbitMQQueueService } from './rabbitmq-queue.service.js';
import { MemoryQueueService } from './memory-queue.service.js';
import env from '../../config/env.js';

export * from './queue.interface.js';
export * from './queue-definitions.js';
export * from './rabbitmq-queue.service.js';
export * from './memory-queue.service.js';

let queueInstance: IQueueService;

if (env.NODE_ENV === 'test') {
  queueInstance = new MemoryQueueService();
} else {
  queueInstance = new RabbitMQQueueService();
}

export const queueService: IQueueService = queueInstance;
