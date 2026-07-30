import type { IQueueService, EnqueueOptions } from './queue.interface.js';

export interface QueuedMessage {
  queueName: string;
  payload: unknown;
  options?: EnqueueOptions | undefined;
  enqueuedAt: Date;
}

export class MemoryQueueService implements IQueueService {
  public messages: QueuedMessage[] = [];
  public topologyAsserted = false;

  public async assertQueues(): Promise<void> {
    this.topologyAsserted = true;
  }

  public async enqueue<T = Record<string, unknown>>(queueName: string, payload: T, options?: EnqueueOptions): Promise<boolean> {
    this.messages.push({
      queueName,
      payload,
      options,
      enqueuedAt: new Date(),
    });
    return true;
  }

  public clear(): void {
    this.messages = [];
    this.topologyAsserted = false;
  }
}
