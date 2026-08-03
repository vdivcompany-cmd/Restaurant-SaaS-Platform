import logger from '../utils/logger.js';

/**
 * Handler function for processing cleanup jobs from queue.
 * Called by QStash webhook endpoint: POST /api/v1/jobs/table-history-cleanup
 */
export async function handleTableHistoryCleanup(jobData: { cutoffDate?: string }): Promise<void> {
  try {
    const { OrderModel } = await import('../modules/orders/model.js');

    const cutoffDate = jobData.cutoffDate
      ? new Date(jobData.cutoffDate)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

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
