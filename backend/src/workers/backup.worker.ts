import { exec } from 'child_process';
import path from 'path';
import cron from 'node-cron';
import { queueService, PLATFORM_QUEUES } from '../services/queue/index.js';
import logger from '../utils/logger.js';
import { connectDatabase } from '../config/database.js';

export interface BackupJobPayload {
  backupType: 'daily' | 'weekly' | 'manual';
  tenantId?: string;
}

export async function processBackupJob(payload: BackupJobPayload, headers?: Record<string, unknown>): Promise<void> {
  const tenantId = (headers?.['x-tenant-id'] as string) || payload.tenantId || 'system';
  logger.info({ tenantId, backupType: payload.backupType }, 'Processing automated backup job');

  const scriptPath = path.resolve(process.cwd(), 'scripts', 'backup.sh');
  const isWindows = process.platform === 'win32';
  const command = isWindows ? `bash "${scriptPath}"` : `"${scriptPath}"`;

  return new Promise((resolve) => {
    exec(command, { cwd: process.cwd() }, (error, stdout, stderr) => {
      if (error) {
        logger.error({ tenantId, error: error.message, stderr }, 'Backup script execution failed');
        // Do not throw — log error so consumer handles gracefully without crash loops
      } else {
        logger.info({ tenantId, stdout: stdout.trim() }, 'Backup script executed successfully');
      }
      resolve();
    });
  });
}

async function startBackupWorker() {
  try {
    await connectDatabase();
    await queueService.assertQueues();

    logger.info(`Starting Backup worker consuming queue: ${PLATFORM_QUEUES.BACKUPS.name}`);
    await queueService.consume<BackupJobPayload>(PLATFORM_QUEUES.BACKUPS.name, async (payload, headers) => {
      await processBackupJob(payload, headers);
    });

    // Schedule automated daily backup job at 2:00 AM
    cron.schedule('0 2 * * *', async () => {
      logger.info('Cron trigger: Enqueuing daily automated backup job');
      await queueService.enqueue(PLATFORM_QUEUES.BACKUPS.name, { backupType: 'daily' }, { tenantId: 'system' });
    });
    logger.info('Scheduled daily backup cron job (0 2 * * *)');
  } catch (error) {
    logger.error({ error }, 'Fatal error starting Backup Worker');
  }
}

if (process.env['NODE_ENV'] !== 'test') {
  startBackupWorker();
}
