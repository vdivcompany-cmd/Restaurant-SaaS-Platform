import { z } from 'zod';

export const approveDraftSchema = z.object({
  mode: z.enum(['replace', 'merge']).default('merge'),
});

export const editDraftSchema = z.object({
  categories: z.array(
    z.object({
      name: z.string().min(1),
      displayOrder: z.number().int().nonnegative().optional(),
      products: z.array(
        z.object({
          name: z.string().min(1),
          description: z.string().optional(),
          basePrice: z.number().nonnegative(),
          imageUrl: z.string().optional(),
        })
      ),
    })
  ),
});

export type ApproveDraftDto = z.infer<typeof approveDraftSchema>;
export type EditDraftDto = z.infer<typeof editDraftSchema>;
