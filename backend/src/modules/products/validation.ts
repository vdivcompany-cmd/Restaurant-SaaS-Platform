import { z } from 'zod';

export const createProductSchema = z.object({
  categoryId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid category ID'),
  name: z.string().min(2).max(150),
  description: z.string().max(500).optional(),
  basePrice: z.number().min(0),
  imageUrl: z.string().url().optional(),
  isAvailable: z.boolean().optional().default(true),
  variantIds: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/)).optional().default([]),
});

export const updateProductSchema = createProductSchema.partial();
export type CreateProductDto = z.infer<typeof createProductSchema>;
export type UpdateProductDto = z.infer<typeof updateProductSchema>;
