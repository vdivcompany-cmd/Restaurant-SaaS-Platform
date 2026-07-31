import { z } from 'zod';

export const sendNotificationSchema = z.object({
  channel: z.enum(['EMAIL', 'TELEGRAM']),
  recipient: z.string().min(1, { message: 'Recipient is required' }),
  message: z.string().min(1, { message: 'Message payload cannot be empty' }),
});

export type SendNotificationDto = z.infer<typeof sendNotificationSchema>;
