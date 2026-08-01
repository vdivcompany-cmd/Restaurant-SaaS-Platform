import cron from 'node-cron';
import logger from '../utils/logger.js';
import { queueService, PLATFORM_QUEUES } from '../services/queue/index.js';

/**
 * Table History Cleanup Worker
 * Scheduled job: Runs at 03:00 on the 1st of every month
 * Purges order detail older than 30 days while preserving Table.totalOrdersServed counter
 *
 * Pattern: '0 3 1 * *' → 03:00 UTC on the 1st day of every month
 */

export function processTableHistoryCleanupJob(): void {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Schedule cron job
  cron.schedule('0 3 1 * *', async () => {
    try {
      logger.info({ timestamp: new Date().toISOString() }, 'Table history cleanup job started');

      // Enqueue cleanup task to be processed by background worker
      const queueName = PLATFORM_QUEUES['TABLE_HISTORY_CLEANUP']?.name ?? 'q.table-history-cleanup';
      await queueService.enqueue(queueName, {
        cutoffDate: thirtyDaysAgo.toISOString(),
        action: 'purge_old_orders',
      });

      logger.info(
        { cutoffDate: thirtyDaysAgo.toISOString() },
        'Table history cleanup job enqueued successfully'
      );
    } catch (err) {
      logger.error({ error: err }, 'Table history cleanup job failed');
    }
  });

  logger.info('Table history cleanup worker scheduled (0 3 1 * * — 1st of every month at 03:00 UTC)');
}

/**
 * Handler function for processing cleanup jobs from queue
 * (Called by the background queue consumer)
 */
export async function handleTableHistoryCleanup(jobData: { cutoffDate: string }): Promise<void> {
  try {
    const { OrderModel } = await import('../modules/orders/model.js');

    const cutoffDate = new Date(jobData.cutoffDate);
    const result = await OrderModel.deleteMany({
      tableId: { $exists: true },
      status: { $in: ['PAID', 'CANCELLED'] },
      createdAt: { $lt: cutoffDate },
    });

    logger.info(
      {
        deletedCount: result.deletedCount,
        cutoffDate: cutoffDate.toISOString(),
      },
      'Table order history purged (>30 days old). Table.totalOrdersServed counters preserved.'
    );
  } catch (err) {
    logger.error({ error: err }, 'Table history cleanup handler failed');
    throw err;
  }
}
