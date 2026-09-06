import type { IQueueService, EnqueueOptions, MessageHandler } from './queue.interface.js';
import { PLATFORM_QUEUES } from './queue-definitions.js';
import { getQStashClient } from '../../config/qstash.js';
import env from '../../config/env.js';
import logger from '../../utils/logger.js';

/**
 * QStash-backed QueueService with local development & offline fallback.
 *
 * "Queues" here map to job routes: q.emails -> POST /api/v1/jobs/emails.
 * In production, jobs are published to Upstash QStash, which delivers HTTP webhooks.
 * In local development (localhost / 127.0.0.1) or when QStash is unconfigured,
 * jobs are dispatched directly in-process via setImmediate to eliminate external webhook barriers.
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

    // ─── Localhost / Direct In-Process Dispatch ──────────────────────────────
    // When running locally on localhost/127.0.0.1 or without a QStash token,
    // cloud QStash cannot reach localhost. We dispatch directly in-process.
    const isLocalhost =
      !env.PUBLIC_API_BASE_URL ||
      env.PUBLIC_API_BASE_URL.includes('localhost') ||
      env.PUBLIC_API_BASE_URL.includes('127.0.0.1') ||
      !env.QSTASH_TOKEN;

    if (isLocalhost) {
      logger.info({ queueName, routeSlug }, 'Localhost detected — executing job directly in-process');
      this.dispatchLocalJob(routeSlug, payload, options);
      return true;
    }

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
      logger.error({ queueName, destinationUrl, err }, 'QStash publish failed — triggering local fallback');
      this.dispatchLocalJob(routeSlug, payload, options);
      return false;
    }
  }

  private dispatchLocalJob<T>(routeSlug: string, payload: T, options?: EnqueueOptions): void {
    const headers = options?.tenantId ? { 'x-tenant-id': options.tenantId } : undefined;

    setImmediate(async () => {
      try {
        switch (routeSlug) {
          case 'emails': {
            const { processEmailJob } = await import('../../workers/email.worker.js');
            await processEmailJob(payload as any, headers);
            break;
          }
          case 'telegram': {
            const { processTelegramJob } = await import('../../workers/telegram.worker.js');
            await processTelegramJob(payload as any, headers);
            break;
          }
          case 'invoices': {
            const { processInvoiceJob } = await import('../../workers/invoice.worker.js');
            await processInvoiceJob(payload as any, headers);
            break;
          }
          case 'subscription-checks': {
            const { processSubscriptionCheckJob } = await import('../../workers/subscription-check.worker.js');
            await processSubscriptionCheckJob(payload as any, headers);
            break;
          }
          case 'payment-retries': {
            const { processPaymentRetryJob } = await import('../../workers/payment-retry.worker.js');
            await processPaymentRetryJob(payload as any, headers);
            break;
          }
          case 'backups': {
            const { processBackupJob } = await import('../../workers/backup.worker.js');
            await processBackupJob(payload as any, headers);
            break;
          }
          case 'firestore-retry': {
            const { processFirestoreRetryJob } = await import('../../workers/firestore-retry.worker.js');
            await processFirestoreRetryJob(payload as any, headers);
            break;
          }
          case 'table-history-cleanup': {
            const { handleTableHistoryCleanup } = await import('../../workers/table-history-cleanup.worker.js');
            await handleTableHistoryCleanup(payload as any);
            break;
          }
          case 'vector-sync': {
            const { processVectorSyncJob } = await import('../../workers/vector-sync.worker.js');
            await processVectorSyncJob(payload as any);
            break;
          }
          case 'menu-ingestion': {
            const { processMenuIngestionJob } = await import('../../workers/menu-ingestion.worker.js');
            await processMenuIngestionJob(payload as any);
            break;
          }
          default:
            logger.warn({ routeSlug }, 'No local worker handler registered for job slug');
        }
      } catch (err: any) {
        logger.error({ routeSlug, err: err?.message ?? err }, 'Local in-process job execution encountered an error');
      }
    });
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
