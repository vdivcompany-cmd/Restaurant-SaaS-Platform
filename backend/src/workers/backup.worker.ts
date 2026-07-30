import { queueService, PLATFORM_QUEUES } from '../services/queue/index.js';
import logger from '../utils/logger.js';
import { connectDatabase } from '../config/database.js';

export interface BackupJobPayload {
  backupType: 'daily' | 'weekly' | 'manual';
  tenantId?: string;
}

export async function processBackupJob(payload: BackupJobPayload, headers?: Record<string, unknown>): Promise<void> {
  const tenantId = (headers?.['x-tenant-id'] as string) || payload.tenantId || 'system';
  logger.info({ tenantId, backupType: payload.backupType }, 'Processing automated backup trigger job');

  // Trigger-only worker — actual backup script execution runs scripts/backup.sh (Phase 6)
}

async function startBackupWorker() {
  try {
    await connectDatabase();
    await queueService.assertQueues();

    logger.info(`Starting Backup worker consuming queue: ${PLATFORM_QUEUES.BACKUPS.name}`);
    await queueService.consume<BackupJobPayload>(PLATFORM_QUEUES.BACKUPS.name, async (payload, headers) => {
      await processBackupJob(payload, headers);
    });
  } catch (error) {
    logger.error({ error }, 'Fatal error starting Backup Worker');
  }
}

if (process.env['NODE_ENV'] !== 'test') {
  startBackupWorker();
}
