import { z } from 'zod';
import { objectIdSchema } from '../../shared/validation/index.js';

export const resolveSessionSchema = z.object({
  token: z.string().min(8).max(64),
  channel: z.enum(['telegram', 'web']),
  channelUserId: z.string().min(1).max(128),
});

export const byChannelQuerySchema = z.object({
  channel: z.enum(['telegram', 'web']),
  channelUserId: z.string().min(1).max(128),
});

export const closeSessionSchema = z.object({
  sessionId: z.string().uuid(),
});

export const saveTableBindingSchema = z.object({
  chatId: z.union([z.string(), z.number()]).transform(String),
  tableId: objectIdSchema,
  tenantId: objectIdSchema.optional(),
  tableSessionId: z.string().uuid().optional(),
});

export type ResolveSessionDto = z.infer<typeof resolveSessionSchema>;
export type ByChannelQuery = z.infer<typeof byChannelQuerySchema>;
export type CloseSessionDto = z.infer<typeof closeSessionSchema>;
export type SaveTableBindingDto = z.infer<typeof saveTableBindingSchema>;
