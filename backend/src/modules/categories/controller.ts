import type { Request, Response, NextFunction } from 'express';
import { CategoryService } from './service.js';
import { createCategorySchema, updateCategorySchema } from './validation.js';

const service = new CategoryService();

export async function createCategoryHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.tenantId ?? '';
    const validated = createCategorySchema.parse(req.body);
    const cat = await service.createCategory(tenantId, validated);
    res.status(201).json({ success: true, data: cat });
  } catch (err) {
    next(err);
  }
}

export async function listCategoriesHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.tenantId ?? '';
    const branchId = typeof req.query['branchId'] === 'string' ? req.query['branchId'] : undefined;
    const categories = await service.listCategories(tenantId, branchId);
    res.status(200).json({ success: true, data: categories });
  } catch (err) {
    next(err);
  }
}

export async function getCategoryHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.tenantId ?? '';
    const id = String(req.params['id'] ?? '');
    const cat = await service.getCategory(tenantId, id);
    res.status(200).json({ success: true, data: cat });
  } catch (err) {
    next(err);
  }
}

export async function updateCategoryHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.tenantId ?? '';
    const id = String(req.params['id'] ?? '');
    const validated = updateCategorySchema.parse(req.body);
    const cat = await service.updateCategory(tenantId, id, validated);
    res.status(200).json({ success: true, data: cat });
  } catch (err) {
    next(err);
  }
}

export async function deleteCategoryHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.tenantId ?? '';
    const id = String(req.params['id'] ?? '');
    await service.deleteCategory(tenantId, id);
    res.status(200).json({ success: true, message: 'Category deleted successfully' });
  } catch (err) {
    next(err);
  }
}
