import type { IQueueService, EnqueueOptions, MessageHandler } from './queue.interface.js';
import { PLATFORM_QUEUES } from './queue-definitions.js';
import { getRabbitMQChannel } from '../../config/rabbitmq.js';
import logger from '../../utils/logger.js';

export class RabbitMQQueueService implements IQueueService {
  private async getChannel() {
    return await getRabbitMQChannel();
  }

  public async assertQueues(): Promise<void> {
    const channel = await this.getChannel();
    // Assert primary exchange & Dead Letter Exchange (DLX)
    await channel.assertExchange('ex.restaurant', 'direct', { durable: true });
    await channel.assertExchange('ex.restaurant.dlx', 'direct', { durable: true });

    for (const q of Object.values(PLATFORM_QUEUES)) {
      // 1. Setup DLQ
      await channel.assertQueue(q.dlqName, { durable: true });
      await channel.bindQueue(q.dlqName, q.dlxExchange, q.routingKey);

      // 2. Setup primary Queue with routing to DLX on rejection/expiration
      await channel.assertQueue(q.name, {
        durable: true,
        arguments: {
          'x-dead-letter-exchange': q.dlxExchange,
          'x-dead-letter-routing-key': q.routingKey,
        },
      });
      await channel.bindQueue(q.name, q.exchange, q.routingKey);
    }
    logger.info('RabbitMQ exchanges, queues, and DLQ topology asserted successfully');
  }

  public async enqueue<T = Record<string, unknown>>(queueName: string, payload: T, options?: EnqueueOptions): Promise<boolean> {
    const channel = await this.getChannel();
    const buffer = Buffer.from(JSON.stringify(payload));
    const headers: Record<string, string> = {};
    if (options?.tenantId) {
      headers['x-tenant-id'] = options.tenantId;
    }

    const sent = channel.sendToQueue(queueName, buffer, {
      persistent: true,
      headers,
      ...(options?.delayMs ? { expiration: options.delayMs.toString() } : {}),
    });

    if (!sent) {
      logger.warn({ queueName, tenantId: options?.tenantId }, 'RabbitMQ buffer full during sendToQueue');
    }
    return sent;
  }

  public async consume<T = Record<string, unknown>>(
    queueName: string,
    handler: MessageHandler<T>
  ): Promise<void> {
    const channel = await this.getChannel();
    await channel.assertQueue(queueName, { durable: true });

    await channel.consume(queueName, async (msg) => {
      if (!msg) return;

      try {
        const payload: T = JSON.parse(msg.content.toString());
        const headers = (msg.properties.headers || {}) as Record<string, unknown>;
        await handler(payload, headers);
        channel.ack(msg);
      } catch (error) {
        logger.error({ queueName, error }, 'Error processing queue message — rejecting to DLQ');
        // nack without requeue sends message to Dead Letter Exchange (DLQ)
        channel.nack(msg, false, false);
      }
    });

    logger.info({ queueName }, 'Subscribed to queue consumer');
  }
}
