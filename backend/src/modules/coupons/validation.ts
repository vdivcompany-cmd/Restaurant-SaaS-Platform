import { z } from 'zod';

export const createCouponSchema = z.object({
  code: z.string().min(2).max(50).toUpperCase(),
  discountPercentage: z.number().int().min(1).max(100),
  expiresAt: z.string().datetime().or(z.string()),
  isActive: z.boolean().optional().default(true),
});

export const updateCouponSchema = createCouponSchema.partial();
export type CreateCouponDto = z.infer<typeof createCouponSchema>;
export type UpdateCouponDto = z.infer<typeof updateCouponSchema>;
