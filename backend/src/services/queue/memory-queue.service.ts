import type { IQueueService, EnqueueOptions, MessageHandler } from './queue.interface.js';

export interface QueuedMessage {
  queueName: string;
  payload: unknown;
  options?: EnqueueOptions | undefined;
  enqueuedAt: Date;
}

export class MemoryQueueService implements IQueueService {
  public messages: QueuedMessage[] = [];
  public topologyAsserted = false;
  private consumers: Map<string, MessageHandler<any>> = new Map();

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

    const handler = this.consumers.get(queueName);
    if (handler) {
      const headers: Record<string, unknown> = {};
      if (options?.tenantId) {
        headers['x-tenant-id'] = options.tenantId;
      }
      setTimeout(() => {
        handler(payload, headers).catch(() => {});
      }, 0);
    }
    return true;
  }

  public async consume<T = Record<string, unknown>>(
    queueName: string,
    handler: MessageHandler<T>
  ): Promise<void> {
    this.consumers.set(queueName, handler as MessageHandler<unknown>);
  }

  public clear(): void {
    this.messages = [];
    this.topologyAsserted = false;
    this.consumers.clear();
  }
}
