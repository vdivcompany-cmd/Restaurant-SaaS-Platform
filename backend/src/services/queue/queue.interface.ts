export interface EnqueueOptions {
  tenantId?: string;
  delayMs?: number;
  priority?: number;
}

export type MessageHandler<T = Record<string, unknown>> = (
  payload: T,
  headers?: Record<string, unknown>
) => Promise<void>;

export interface IQueueService {
  /** Assert exchange and queue topology (including DLX and DLQ binds) */
  assertQueues(): Promise<void>;
  /** Enqueue message payload safely with tenant telemetry header */
  enqueue<T = Record<string, unknown>>(queueName: string, payload: T, options?: EnqueueOptions): Promise<boolean>;
  /** Consume messages from a specified queue with callback handler */
  consume<T = Record<string, unknown>>(queueName: string, handler: MessageHandler<T>): Promise<void>;
}
