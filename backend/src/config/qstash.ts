import { Client } from '@upstash/qstash';
import env from './env.js';
import logger from '../utils/logger.js';

let _client: Client | null = null;

/**
 * Upstash QStash client — HTTP-based, push-driven queue.
 *
 * Unlike RabbitMQ, there is no persistent connection or channel to manage.
 * QStash calls back into a Vercel API route (POST /api/v1/jobs/:queueName)
 * as an HTTP webhook when a job is due, with signed headers verified by
 * qstashVerifyMiddleware (see middleware/qstash.middleware.ts).
 *
 * Business logic must never import this directly — it must go through
 * QueueService (services/queue/qstash-queue.service.ts).
 */
export function getQStashClient(): Client {
  if (_client) return _client;
  _client = new Client({ token: env.QSTASH_TOKEN });
  logger.info('Upstash QStash client initialized');
  return _client;
}
