import type { Request, Response, NextFunction } from 'express';
import { VariantService } from './service.js';
import { createVariantSchema, updateVariantSchema } from './validation.js';

const service = new VariantService();

export async function createVariantHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.tenantId ?? '';
    const validated = createVariantSchema.parse(req.body);
    const variant = await service.createVariant(tenantId, validated);
    res.status(201).json({ success: true, data: variant });
  } catch (err) {
    next(err);
  }
}

export async function listVariantsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.tenantId ?? '';
    const branchId = typeof req.query['branchId'] === 'string' ? req.query['branchId'] : undefined;
    const variants = await service.listVariants(tenantId, branchId);
    res.status(200).json({ success: true, data: variants });
  } catch (err) {
    next(err);
  }
}

export async function getVariantHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.tenantId ?? '';
    const id = String(req.params['id'] ?? '');
    const variant = await service.getVariant(tenantId, id);
    res.status(200).json({ success: true, data: variant });
  } catch (err) {
    next(err);
  }
}

export async function updateVariantHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.tenantId ?? '';
    const id = String(req.params['id'] ?? '');
    const validated = updateVariantSchema.parse(req.body);
    const variant = await service.updateVariant(tenantId, id, validated);
    res.status(200).json({ success: true, data: variant });
  } catch (err) {
    next(err);
  }
}

export async function deleteVariantHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.tenantId ?? '';
    const id = String(req.params['id'] ?? '');
    await service.deleteVariant(tenantId, id);
    res.status(200).json({ success: true, message: 'Variant deleted successfully' });
  } catch (err) {
    next(err);
  }
}
