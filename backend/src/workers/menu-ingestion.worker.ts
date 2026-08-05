import logger from '../utils/logger.js';
import { menuIngestionService } from '../modules/menu-ingestion/service.js';

export interface MenuIngestionJobPayload {
  draftId: string;
  tenantId: string;
  filename: string;
  mimetype: string;
  /** base64-encoded file bytes */
  base64: string;
}

export async function processMenuIngestionJob(payload: MenuIngestionJobPayload): Promise<void> {
  const { draftId, tenantId, filename, mimetype, base64 } = payload;
  logger.info({ draftId, tenantId, filename }, 'Processing menu ingestion job');

  const buffer = Buffer.from(base64, 'base64');
  await menuIngestionService.processDraft(draftId, {
    buffer,
    mimetype,
    originalname: filename,
  });
}
