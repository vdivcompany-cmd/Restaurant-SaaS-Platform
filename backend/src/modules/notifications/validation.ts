import { z } from 'zod';
import { objectIdSchema } from '../../shared/validation/index.js';

export const sendNotificationSchema = z.object({
  channel: z.enum(['EMAIL', 'TELEGRAM']),
  recipient: z.string().min(1, { message: 'Recipient is required' }),
  subject: z.string().optional(),
  message: z.string().min(1, { message: 'Message payload cannot be empty' }),
  branchId: objectIdSchema.optional(),
  tableNumber: z.number().int().min(1).optional(),
});

export type SendNotificationDto = z.infer<typeof sendNotificationSchema>;
