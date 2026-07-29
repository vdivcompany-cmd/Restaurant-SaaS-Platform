import amqplib from 'amqplib';
import env from './env.js';
import logger from '../utils/logger.js';

// amqplib v2 uses ChannelModel for the connection object
type AmqpConnection = Awaited<ReturnType<typeof amqplib.connect>>;
type AmqpChannel = Awaited<ReturnType<AmqpConnection['createChannel']>>;

let connection: AmqpConnection | null = null;
let channel: AmqpChannel | null = null;

/**
 * Returns the singleton RabbitMQ channel via CloudAMQP.
 *
 * CloudAMQP provides an `amqps://` URL (TLS-encrypted AMQP).
 * amqplib handles TLS automatically when the URL scheme is `amqps://`.
 *
 * Business logic must never import this directly — it must go through
 * QueueService (Phase 2). This file is used only by:
 *   - QueueService implementation (services/queue/rabbitmq-queue.service.ts)
 *   - The connectivity verification script (scripts/verify-connections.ts)
 *
 * Credentials: RABBITMQ_URL from your CloudAMQP dashboard → instance → AMQP URL.
 */
export async function getRabbitMQChannel(): Promise<AmqpChannel> {
  if (channel) return channel;

  connection = await amqplib.connect(env.RABBITMQ_URL);
  logger.info('CloudAMQP RabbitMQ connected');

  // amqplib v2: events are on the underlying socket via EventEmitter
  (connection as unknown as NodeJS.EventEmitter).on('error', (err: Error) => {
    logger.error({ err }, 'RabbitMQ connection error');
  });

  (connection as unknown as NodeJS.EventEmitter).on('close', () => {
    logger.warn('RabbitMQ connection closed — will reconnect on next operation');
    connection = null;
    channel = null;
  });

  channel = await connection.createChannel();

  // Prefetch 1: each worker processes one message at a time before ACKing.
  // Prevents any single worker from hogging all messages in the queue.
  await channel.prefetch(1);

  logger.info('RabbitMQ channel created');
  return channel;
}

/**
 * Gracefully closes the RabbitMQ channel and connection.
 * Called on SIGTERM/SIGINT in server.ts.
 */
export async function disconnectRabbitMQ(): Promise<void> {
  try {
    if (channel) {
      await channel.close();
      channel = null;
    }
    if (connection) {
      await connection.close();
      connection = null;
    }
    logger.info('RabbitMQ connection closed gracefully');
  } catch (err) {
    logger.error({ err }, 'Error closing RabbitMQ connection');
  }
}
