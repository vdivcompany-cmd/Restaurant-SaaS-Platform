import { z } from 'zod';

export const createBranchSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  address: z.string().min(5).max(255),
  phone: z.string().min(6).max(25),
  isActive: z.boolean().optional().default(true),
  tableCount: z.number().int().min(0).optional().default(0),
});

export const updateBranchSchema = createBranchSchema.partial();
export type CreateBranchDto = z.infer<typeof createBranchSchema>;
export type UpdateBranchDto = z.infer<typeof updateBranchSchema>;
