import type { Request, Response, NextFunction } from 'express';
import { MenuService } from './service.js';

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
