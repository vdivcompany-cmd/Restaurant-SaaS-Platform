import type { Request, Response, NextFunction } from 'express';
import { ProductService } from './service.js';
import { createProductSchema, updateProductSchema } from './validation.js';

const service = new ProductService();

export async function createProductHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.tenantId ?? '';
    const validated = createProductSchema.parse(req.body);
    const prod = await service.createProduct(tenantId, validated);
    res.status(201).json({ success: true, data: prod });
  } catch (err) {
    next(err);
  }
}

export async function listProductsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.tenantId ?? '';
    const branchId = typeof req.query['branchId'] === 'string' ? req.query['branchId'] : undefined;
    const products = await service.listProducts(tenantId, branchId);
    res.status(200).json({ success: true, data: products });
  } catch (err) {
    next(err);
  }
}

export async function getProductHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.tenantId ?? '';
    const id = String(req.params['id'] ?? '');
    const prod = await service.getProduct(tenantId, id);
    res.status(200).json({ success: true, data: prod });
  } catch (err) {
    next(err);
  }
}

export async function updateProductHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.tenantId ?? '';
    const id = String(req.params['id'] ?? '');
    const validated = updateProductSchema.parse(req.body);
    const prod = await service.updateProduct(tenantId, id, validated);
    res.status(200).json({ success: true, data: prod });
  } catch (err) {
    next(err);
  }
}

export async function deleteProductHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.tenantId ?? '';
    const id = String(req.params['id'] ?? '');
    await service.deleteProduct(tenantId, id);
    res.status(200).json({ success: true, message: 'Product deleted successfully' });
  } catch (err) {
    next(err);
  }
}
