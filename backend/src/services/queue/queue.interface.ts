export interface EnqueueOptions {
  tenantId?: string;
  delayMs?: number;
  priority?: number;
}

export interface IQueueService {
  /** Assert exchange and queue topology (including DLX and DLQ binds) */
  assertQueues(): Promise<void>;
  /** Enqueue message payload safely with tenant telemetry header */
  enqueue<T = Record<string, unknown>>(queueName: string, payload: T, options?: EnqueueOptions): Promise<boolean>;
}
