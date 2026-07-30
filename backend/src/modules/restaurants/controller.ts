import type { Request, Response, NextFunction } from 'express';
import { RestaurantService } from './service.js';
import { restaurantProfileSchema } from './validation.js';

const service = new RestaurantService();

export async function upsertRestaurantHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.tenantId ?? '';
    const validated = restaurantProfileSchema.parse(req.body);
    const profile = await service.upsertProfile(tenantId, validated);
    res.status(200).json({ success: true, data: profile });
  } catch (err) {
    next(err);
  }
}

export async function getRestaurantHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.tenantId ?? '';
    const profile = await service.getProfile(tenantId);
    res.status(200).json({ success: true, data: profile });
  } catch (err) {
    next(err);
  }
}
