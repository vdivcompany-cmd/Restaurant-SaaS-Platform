import type { Request, Response, NextFunction } from 'express';
import { MenuService } from './service.js';
import { bulkImportSchema, singleProductSchema } from './validation.js';

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
    const rawTenantId = req.params['tenantId'] || req.query['tenantId'] || req.tenantId || '';
    const tenantId = Array.isArray(rawTenantId) ? String(rawTenantId[0]) : String(rawTenantId);
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

export async function addProductHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.tenantId ?? req.body?.tenantId ?? '';
    const validated = singleProductSchema.parse(req.body);
    const product = await service.addOrUpdateProduct(tenantId, validated as any);
    res.status(201).json({ success: true, data: product });
  } catch (err) {
    next(err);
  }
}

export async function updateProductHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.tenantId ?? req.body?.tenantId ?? '';
    const productId = String(req.params['id'] ?? '');
    const validated = singleProductSchema.partial().parse(req.body);
    const product = await service.updateProduct(tenantId, productId, validated as any);
    res.status(200).json({ success: true, data: product });
  } catch (err) {
    next(err);
  }
}

export async function deleteProductHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.tenantId ?? req.body?.tenantId ?? '';
    const productId = String(req.params['id'] ?? '');
    await service.deleteProduct(tenantId, productId);
    res.status(200).json({ success: true, message: 'Product item removed from menu successfully' });
  } catch (err) {
    next(err);
  }
}

export async function getProductHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.tenantId ?? String(req.query['tenantId'] ?? '');
    const productId = String(req.params['id'] ?? '');
    const product = await service.getProduct(tenantId, productId);
    res.status(200).json({ success: true, data: product });
  } catch (err) {
    next(err);
  }
}

export async function listSourceDocumentsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = String(req.params['tenantId'] ?? req.tenantId ?? '');
    if (!tenantId) {
      res.status(400).json({ success: false, message: 'Tenant ID is required in URL params' });
      return;
    }
    const docs = await service.listSourceDocuments(tenantId);
    res.status(200).json({ success: true, count: docs.length, data: docs });
  } catch (err) {
    next(err);
  }
}

export async function listProductsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.tenantId ?? String(req.query['tenantId'] ?? '');
    const categoryId = typeof req.query['categoryId'] === 'string' ? req.query['categoryId'] : undefined;
    const products = await service.listProducts(tenantId, categoryId);
    res.status(200).json({ success: true, data: products });
  } catch (err) {
    next(err);
  }
}

