import { z } from 'zod';

export const createFeedbackSchema = z.object({
  branchId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid branch ID'),
  orderId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
  customerName: z.string().max(100).optional(),
});

export type CreateFeedbackDto = z.infer<typeof createFeedbackSchema>;
