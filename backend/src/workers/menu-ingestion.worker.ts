import axios from 'axios';
import { MenuService } from '../modules/menu/service.js';
import { MenuUploadStatusModel } from '../modules/menu/upload-status.model.js';
import { getParserForMime } from '../modules/menu/parsers/index.js';
import { bulkImportSchema } from '../modules/menu/validation.js';
import type { UploadSourceType } from '../modules/menu/upload-status.model.js';
import logger from '../utils/logger.js';

const menuService = new MenuService();

export interface MenuIngestionJobPayload {
  statusId: string;
  tenantId: string;
  branchId?: string;
  fileUrl: string;
  publicId: string;
  fileType: UploadSourceType;
  originalFilename: string;
  mimetype: string;
  /** base64 fallback — used in test/simulated-Cloudinary environments */
  base64?: string;
}

export async function processMenuIngestionJob(payload: MenuIngestionJobPayload): Promise<void> {
  const { statusId, tenantId, fileUrl, publicId, fileType, originalFilename, mimetype, base64 } = payload;

  logger.info({ statusId, tenantId, fileType, originalFilename }, 'Starting menu ingestion job');

  // ── 1. Mark processing ──────────────────────────────────────────────────
  await MenuUploadStatusModel.findByIdAndUpdate(statusId, { status: 'processing' });

  try {
    // ── 2. Acquire the file buffer ─────────────────────────────────────────
    let buffer: Buffer;
    if (base64) {
      buffer = Buffer.from(base64, 'base64');
    } else {
      const response = await axios.get<ArrayBuffer>(fileUrl, { responseType: 'arraybuffer', timeout: 30_000 });
      buffer = Buffer.from(response.data);
    }

    // ── 3. Parse the file into structured menu data ────────────────────────
    const parser = getParserForMime(mimetype, originalFilename);
    const parsed = await parser.parse({ buffer, mimetype, originalname: originalFilename });

    // ── 4. Validate + fill Zod defaults ───────────────────────────────────
    const bulkPayload = bulkImportSchema.parse({ categories: parsed.categories });

    // ── 5. Import into MongoDB (cache-invalidating, vector-syncing path) ───
    const result = await menuService.bulkImportMenu(tenantId, bulkPayload);

    // ── 6. Record source document on the Menu (audit trail) ────────────────
    // This happens AFTER bulkImport succeeds — never before, to avoid premature vector sync.
    await menuService.recordSourceDocument(tenantId, {
      url: fileUrl,
      publicId,
      fileType,
      originalFilename,
      uploadedAt: new Date(),
    });

    // ── 7. Mark completed ──────────────────────────────────────────────────
    await MenuUploadStatusModel.findByIdAndUpdate(statusId, {
      status: 'completed',
      resultCategoriesCount: result.categoriesCount,
      resultProductsCount: result.productsCount,
    });

    logger.info(
      { statusId, tenantId, categoriesCount: result.categoriesCount, productsCount: result.productsCount },
      'Menu ingestion job completed'
    );
  } catch (err: any) {
    const errorMessage = err?.message ?? 'Unknown error during menu ingestion';
    logger.error({ statusId, tenantId, err: errorMessage }, 'Menu ingestion job failed');
    await MenuUploadStatusModel.findByIdAndUpdate(statusId, {
      status: 'failed',
      errorMessage,
    });
    throw err;
  }
}
