import { z } from 'zod';

export const uploadMenuDocSchema = z.object({
  title: z.string().min(1).max(200).trim(),
});

export const updateMenuDocSchema = z.object({
  title: z.string().min(1).max(200).trim().optional(),
  isActive: z.boolean().optional(),
});

export type UploadMenuDocDto = z.infer<typeof uploadMenuDocSchema>;
export type UpdateMenuDocDto = z.infer<typeof updateMenuDocSchema>;
