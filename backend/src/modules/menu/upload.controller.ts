import type { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { MenuService } from './service.js';
import { MenuUploadStatusModel } from './upload-status.model.js';
import { uploadJsonBodySchema, uploadFileMetaSchema } from './validation.js';
import { uploadTenantMedia } from '../../integrations/cloudinary/index.js';
import { queueService } from '../../services/queue/index.js';
import { PLATFORM_QUEUES } from '../../services/queue/queue-definitions.js';
import { AppError } from '../../middleware/errorHandler.middleware.js';
import { getParserForMime } from './parsers/index.js';
import type { UploadSourceType } from './upload-status.model.js';

const service = new MenuService();

function mimeToSourceType(mimetype: string, filename: string): UploadSourceType {
  const lower = mimetype.toLowerCase();
  const name = (filename || '').toLowerCase();
  if (lower.includes('csv') || name.endsWith('.csv')) return 'csv';
  if (lower === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (
    lower === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    name.endsWith('.docx')
  ) return 'docx';
  if (lower.startsWith('image/')) return 'image';
  return 'csv';
}

/**
 * POST /api/v1/menu/upload
 *
 * - JSON body (Content-Type: application/json): synchronous bulk import.
 * - multipart/form-data with `file` field: Cloudinary upload + async QStash job, returns 202.
 */
export async function uploadMenuHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.tenantId ?? '';
    if (!tenantId) throw new AppError('Tenant ID is required', 400);

    const file = (req as any).file as Express.Multer.File | undefined;

    if (!file) {
      // ── JSON synchronous path ────────────────────────────────────────────
      const validated = uploadJsonBodySchema.parse(req.body);
      const result = await service.bulkImportMenu(tenantId, { categories: validated.categories });

      res.status(200).json({
        success: true,
        message: 'Menu import completed successfully',
        data: result,
      });
      return;
    }

    // ── File async path ─────────────────────────────────────────────────────
    // Validate the file type has a real parser (fail fast before Cloudinary upload)
    getParserForMime(file.mimetype, file.originalname);

    const meta = uploadFileMetaSchema.parse(req.body);
    const sourceType = mimeToSourceType(file.mimetype, file.originalname);

    // 1. Upload raw file to Cloudinary for persistence and worker download
    const cloudResult = await uploadTenantMedia(
      file.buffer,
      tenantId,
      'menu-docs',
      file.originalname
    );

    // 2. Create a status record the client can poll
    const statusDoc = await MenuUploadStatusModel.create({
      tenantId: new Types.ObjectId(tenantId),
      sourceType,
      sourceFilename: file.originalname,
      status: 'queued',
      sourceDocumentPublicId: cloudResult.publicId,
    });

    // 3. Enqueue the parse + import job
    await queueService.enqueue(
      PLATFORM_QUEUES.MENU_INGESTION.name,
      {
        statusId: statusDoc._id.toString(),
        tenantId,
        branchId: meta.branchId,
        fileUrl: cloudResult.url,
        publicId: cloudResult.publicId,
        fileType: sourceType,
        originalFilename: file.originalname,
        // base64 included for test-mode where the Cloudinary URL is simulated
        base64: file.buffer.toString('base64'),
        mimetype: file.mimetype,
      },
      { tenantId }
    );

    res.status(202).json({
      success: true,
      message: 'File received and queued for processing',
      data: { statusId: statusDoc._id.toString() },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/menu/uploads/:id
 * Poll the status of a file-based upload job.
 */
export async function getUploadStatusHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.tenantId ?? '';
    const statusId = String(req.params['id'] ?? '');

    const statusDoc = await MenuUploadStatusModel.findOne({
      _id: statusId,
      tenantId: new Types.ObjectId(tenantId),
    });

    if (!statusDoc) throw new AppError('Upload status not found', 404);

    res.status(200).json({ success: true, data: statusDoc });
  } catch (err) {
    next(err);
  }
}
