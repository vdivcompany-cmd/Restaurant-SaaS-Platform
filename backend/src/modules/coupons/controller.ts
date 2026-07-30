import type { Request, Response, NextFunction } from 'express';
import { CouponService } from './service.js';
import { createCouponSchema, updateCouponSchema } from './validation.js';

const service = new CouponService();

export async function createCouponHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.tenantId ?? '';
    const validated = createCouponSchema.parse(req.body);
    const c = await service.createCoupon(tenantId, validated);
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
    const tenantId = req.tenantId ?? '';
    const code = typeof req.query['code'] === 'string' ? req.query['code'] : '';
    const result = await service.validateCoupon(tenantId, code);
    res.status(200).json({ success: true, data: result });
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
