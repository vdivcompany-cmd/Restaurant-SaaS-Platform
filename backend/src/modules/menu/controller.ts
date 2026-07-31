import type { Request, Response, NextFunction } from 'express';
import { MenuService } from './service.js';
import { bulkImportSchema } from './validation.js';

const service = new MenuService();

export async function getMenuCatalogHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.tenantId ?? '';
    const catalog = await service.getFullMenu(tenantId);
    res.status(200).json({ success: true, data: catalog });
  } catch (err) {
    next(err);
  }
}

export async function bulkImportMenuHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.tenantId;
    if (!tenantId) {
      res.status(400).json({ success: false, message: 'Tenant ID is required' });
      return;
    }

    // Validate payload with Zod per Rule #4
    const validatedPayload = bulkImportSchema.parse(req.body);
    const result = await service.bulkImportMenu(tenantId, validatedPayload);

    res.status(201).json({
      success: true,
      message: 'Menu bulk import completed successfully',
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function getRagCatalogHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.params['tenantId'] || (req.query['tenantId'] as string) || req.tenantId || '';
    if (!tenantId) {
      res.status(400).json({ success: false, message: 'Tenant ID is required for RAG catalog extraction' });
      return;
    }
    const ragData = await service.getRagCatalog(tenantId);
    res.status(200).json({ success: true, data: ragData });
  } catch (err) {
    next(err);
  }
}
