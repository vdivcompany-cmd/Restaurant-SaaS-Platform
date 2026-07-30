import { z } from 'zod';

export const createCategorySchema = z.object({
  name: z.string().min(2).max(100),
  displayOrder: z.number().int().optional().default(0),
  isActive: z.boolean().optional().default(true),
});

export const updateCategorySchema = createCategorySchema.partial();
export type CreateCategoryDto = z.infer<typeof createCategorySchema>;
export type UpdateCategoryDto = z.infer<typeof updateCategorySchema>;
