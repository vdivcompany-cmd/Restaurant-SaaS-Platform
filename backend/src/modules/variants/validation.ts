import { z } from 'zod';

export const createVariantSchema = z.object({
  name: z.string().min(2).max(100),
  minSelect: z.number().int().min(0).optional().default(0),
  maxSelect: z.number().int().min(1).optional().default(1),
  options: z.array(
    z.object({
      name: z.string().min(1).max(100),
      priceDelta: z.number().default(0),
      isDefault: z.boolean().optional().default(false),
    })
  ).min(1, 'At least one option must be specified'),
});

export const updateVariantSchema = createVariantSchema.partial();
export type CreateVariantDto = z.infer<typeof createVariantSchema>;
export type UpdateVariantDto = z.infer<typeof updateVariantSchema>;
