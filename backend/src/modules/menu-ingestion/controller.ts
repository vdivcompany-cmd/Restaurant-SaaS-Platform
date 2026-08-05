import type { Request, Response, NextFunction } from 'express';
import { menuIngestionService } from './service.js';
import { approveDraftSchema, editDraftSchema } from './validation.js';
import { AppError } from '../../middleware/errorHandler.middleware.js';

export async function uploadMenuHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.tenantId ?? '';
    const file = (req as any).file as { buffer: Buffer; mimetype: string; originalname: string } | undefined;
    if (!file) throw new AppError('No file uploaded (expected multipart field "file")', 400);

    const draft = await menuIngestionService.startUpload(tenantId, file);
    res.status(202).json({
      success: true,
      message: 'Menu upload received. Poll GET /menu-ingestion/drafts/:id for status.',
      data: draft,
    });
  } catch (err) {
    next(err);
  }
}

export async function listDraftsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.tenantId ?? '';
    const drafts = await menuIngestionService.listDrafts(tenantId);
    res.status(200).json({ success: true, data: drafts });
  } catch (err) {
    next(err);
  }
}

export async function getDraftHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.tenantId ?? '';
    const draftId = String(req.params['id'] ?? '');
    const draft = await menuIngestionService.getDraft(tenantId, draftId);
    res.status(200).json({ success: true, data: draft });
  } catch (err) {
    next(err);
  }
}

export async function editDraftHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.tenantId ?? '';
    const draftId = String(req.params['id'] ?? '');
    const dto = editDraftSchema.parse(req.body);
    const draft = await menuIngestionService.editDraft(tenantId, draftId, dto.categories as any);
    res.status(200).json({ success: true, data: draft });
  } catch (err) {
    next(err);
  }
}

export async function approveDraftHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.tenantId ?? '';
    const draftId = String(req.params['id'] ?? '');
    const dto = approveDraftSchema.parse(req.body ?? {});
    const result = await menuIngestionService.approveDraft(tenantId, draftId, dto.mode);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}
