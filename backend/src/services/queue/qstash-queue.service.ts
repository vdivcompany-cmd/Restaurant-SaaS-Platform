import type { IQueueService, EnqueueOptions, MessageHandler } from './queue.interface.js';
import { PLATFORM_QUEUES } from './queue-definitions.js';
import { getQStashClient } from '../../config/qstash.js';
import env from '../../config/env.js';
import logger from '../../utils/logger.js';

/**
 * QStash-backed QueueService.
 *
 * "Queues" here map to job routes: q.emails -> POST /api/v1/jobs/emails.
 * assertQueues() is a no-op — QStash has no exchange/queue topology to
 * declare; the destination URL IS the queue.
 * consume() is intentionally unsupported — see JOB_ROUTES.md. Workers become
 * Vercel API routes that QStash calls directly.
 */
export class QStashQueueService implements IQueueService {
  private get client() {
    return getQStashClient();
  }

  public async assertQueues(): Promise<void> {
    // No-op by design: QStash has no server-side topology to declare.
    logger.info('QStash: topology assertion skipped (push-based queue, no exchanges/queues to declare)');
  }

  public async enqueue<T = Record<string, unknown>>(
    queueName: string,
    payload: T,
    options?: EnqueueOptions
  ): Promise<boolean> {
    const def = Object.values(PLATFORM_QUEUES).find((q) => q.name === queueName);
    const routeSlug = def?.jobRoute ?? queueName.replace(/^q\./, '');
    const destinationUrl = `${env.PUBLIC_API_BASE_URL}/api/v1/jobs/${routeSlug}`;

    try {
      const headers: Record<string, string> = {};
      if (options?.tenantId) headers['x-tenant-id'] = options.tenantId;

      await this.client.publishJSON({
        url: destinationUrl,
        body: payload,
        headers,
        retries: def?.maxRetries ?? 3,
        ...(options?.delayMs ? { delay: Math.ceil(options.delayMs / 1000) } : {}),
      });
      return true;
    } catch (err) {
      logger.error({ queueName, destinationUrl, err }, 'QStash publish failed');
      return false;
    }
  }

  public async consume<T = Record<string, unknown>>(
    _queueName: string,
    _handler: MessageHandler<T>
  ): Promise<void> {
    throw new Error(
      'QStashQueueService.consume() is not supported. QStash is push-based: ' +
        'implement the job as a Vercel API route under src/jobs/ instead.'
    );
  }
}
