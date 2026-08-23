import { z } from 'zod';

export const createCouponSchema = z.object({
  code: z.string().min(2).max(50).toUpperCase().trim(),
  discountType: z.enum(['PERCENTAGE', 'FIXED']).optional().default('PERCENTAGE'),
  discountValue: z.number().min(0).optional(),
  discountPercentage: z.number().int().min(1).max(100).optional(),
  minOrderAmount: z.number().min(0).optional().default(0),
  maxDiscountCap: z.number().min(0).optional(),
  usageLimit: z.number().int().min(1).optional(),
  expiresAt: z.string().datetime().or(z.string()),
  isActive: z.boolean().optional().default(true),
}).transform((data) => {
  const discountValue = data.discountValue ?? data.discountPercentage ?? 0;
  const discountPercentage = data.discountType === 'PERCENTAGE' ? discountValue : undefined;
  return {
    ...data,
    discountValue,
    ...(discountPercentage !== undefined ? { discountPercentage } : {}),
  };
});

export const updateCouponSchema = z.object({
  code: z.string().min(2).max(50).toUpperCase().trim().optional(),
  discountType: z.enum(['PERCENTAGE', 'FIXED']).optional(),
  discountValue: z.number().min(0).optional(),
  discountPercentage: z.number().int().min(1).max(100).optional(),
  minOrderAmount: z.number().min(0).optional(),
  maxDiscountCap: z.number().min(0).optional(),
  usageLimit: z.number().int().min(1).optional(),
  expiresAt: z.string().datetime().or(z.string()).optional(),
  isActive: z.boolean().optional(),
});

export type CreateCouponDto = z.infer<typeof createCouponSchema>;
export type UpdateCouponDto = z.infer<typeof updateCouponSchema>;

