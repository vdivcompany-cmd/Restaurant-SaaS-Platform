import type { Request, Response, NextFunction } from 'express';
import { menuDocService } from './service.js';
import { uploadMenuDocSchema, updateMenuDocSchema } from './validation.js';
import { AppError } from '../../middleware/errorHandler.middleware.js';

/**
 * POST /api/v1/menu-docs/upload
 * Authenticated (owner/manager) — upload a menu document file.
 */
export async function uploadMenuDocHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.tenantId ?? '';
    const file = (req as any).file as { buffer: Buffer; mimetype: string; originalname: string } | undefined;
    if (!file) throw new AppError('No file uploaded (expected multipart field "file")', 400);

    const dto = uploadMenuDocSchema.parse(req.body);
    const uploadedBy = req.user?.id;
    const doc = await menuDocService.uploadDocument(tenantId, dto, file, uploadedBy);

    res.status(201).json({ success: true, data: doc });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/menu-docs
 * Public (tenant-scoped) — list active menu documents.
 * Authenticated staff can pass ?all=true to see inactive ones too.
 */
export async function listMenuDocsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.tenantId ?? '';
    const showAll = req.query['all'] === 'true' && Boolean(req.user);
    const docs = await menuDocService.listDocuments(tenantId, !showAll);
    res.status(200).json({ success: true, data: docs });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/menu-docs/:id
 * Public (tenant-scoped) — get a single menu document metadata (includes fileUrl).
 */
export async function getMenuDocHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.tenantId ?? '';
    const docId = String(req.params['id'] ?? '');
    const doc = await menuDocService.getDocument(tenantId, docId);
    res.status(200).json({ success: true, data: doc });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/menu-docs/:id
 * Authenticated (owner/manager) — update title or toggle isActive.
 */
export async function updateMenuDocHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.tenantId ?? '';
    const docId = String(req.params['id'] ?? '');
    const dto = updateMenuDocSchema.parse(req.body);
    const doc = await menuDocService.updateDocument(tenantId, docId, dto);
    res.status(200).json({ success: true, data: doc });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/v1/menu-docs/:id
 * Authenticated (owner/manager) — delete document from Cloudinary + DB.
 */
export async function deleteMenuDocHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.tenantId ?? '';
    const docId = String(req.params['id'] ?? '');
    await menuDocService.deleteDocument(tenantId, docId);
    res.status(200).json({ success: true, message: 'Menu document deleted' });
  } catch (err) {
    next(err);
  }
}
