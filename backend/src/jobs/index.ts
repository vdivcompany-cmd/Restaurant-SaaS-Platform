import { Router } from 'express';
import { qstashVerifyMiddleware } from '../middleware/qstash.middleware.js';
import { processEmailJob } from '../workers/email.worker.js';
import { processTelegramJob } from '../workers/telegram.worker.js';
import { processInvoiceJob } from '../workers/invoice.worker.js';
import { processSubscriptionCheckJob } from '../workers/subscription-check.worker.js';
import { processPaymentRetryJob } from '../workers/payment-retry.worker.js';
import { processBackupJob } from '../workers/backup.worker.js';
import { processFirestoreRetryJob } from '../workers/firestore-retry.worker.js';
import { handleTableHistoryCleanup } from '../workers/table-history-cleanup.worker.js';
import logger from '../utils/logger.js';

const router = Router();
router.use(qstashVerifyMiddleware);

function jobRoute<T>(name: string, handler: (payload: T, headers?: Record<string, unknown>) => Promise<void>) {
  router.post(`/${name}`, async (req, res) => {
    try {
      await handler(req.body as T, req.headers as Record<string, unknown>);
      res.status(200).json({ success: true });
    } catch (err) {
      logger.error({ err, job: name }, 'Job handler threw — QStash will retry per maxRetries');
      // Non-2xx tells QStash to retry according to the queue's retry policy
      res.status(500).json({ success: false });
    }
  });
}

jobRoute('emails', processEmailJob);
jobRoute('telegram', processTelegramJob);
jobRoute('invoices', processInvoiceJob);
jobRoute('subscription-checks', processSubscriptionCheckJob);
jobRoute('payment-retries', processPaymentRetryJob);
jobRoute('backups', processBackupJob);
jobRoute('firestore-retry', processFirestoreRetryJob);
jobRoute('table-history-cleanup', (payload: { cutoffDate: string }) => handleTableHistoryCleanup(payload));

export default router;
