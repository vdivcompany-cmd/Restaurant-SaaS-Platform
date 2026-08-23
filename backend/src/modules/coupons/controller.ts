import type { Request, Response, NextFunction } from 'express';
import { CouponService } from './service.js';
import { createCouponSchema, updateCouponSchema } from './validation.js';

const service = new CouponService();

export async function createCouponHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.tenantId ?? '';
    const validated = createCouponSchema.parse(req.body);
    const creatorUserId = (req.user as any)?.id || (req.user as any)?._id?.toString();
    const c = await service.createCoupon(tenantId, validated, creatorUserId);
    res.status(201).json({ success: true, data: c });
  } catch (err) {
    next(err);
  }
}

export async function listCouponsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.tenantId ?? '';
    const coupons = await service.listCoupons(tenantId);
    res.status(200).json({ success: true, data: coupons });
  } catch (err) {
    next(err);
  }
}

export async function validateCouponHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.tenantId || (req.query['tenantId'] as string) || (req.body?.tenantId as string) || '';
    const code = String(req.query['code'] || req.body?.code || '').trim();
    const rawSubtotal = req.query['subtotal'] ?? req.body?.subtotal;
    const subtotal = rawSubtotal !== undefined ? Number(rawSubtotal) : undefined;
    
    const result = await service.validateCoupon(tenantId, code, subtotal);
    if (!result.valid) {
      res.status(200).json({ success: false, data: result, ...result });
      return;
    }
    res.status(200).json({ success: true, data: result, ...result });
  } catch (err) {
    next(err);
  }
}

export async function updateCouponHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.tenantId ?? '';
    const id = String(req.params['id'] ?? '');
    const validated = updateCouponSchema.parse(req.body);
    const c = await service.updateCoupon(tenantId, id, validated);
    res.status(200).json({ success: true, data: c });
  } catch (err) {
    next(err);
  }
}

export async function deleteCouponHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.tenantId ?? '';
    const id = String(req.params['id'] ?? '');
    await service.deleteCoupon(tenantId, id);
    res.status(200).json({ success: true, message: 'Coupon deleted successfully' });
  } catch (err) {
    next(err);
  }
}

