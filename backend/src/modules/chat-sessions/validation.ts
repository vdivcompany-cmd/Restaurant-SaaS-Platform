import { z } from 'zod';

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

export type ResolveSessionDto = z.infer<typeof resolveSessionSchema>;
export type ByChannelQuery = z.infer<typeof byChannelQuerySchema>;
export type CloseSessionDto = z.infer<typeof closeSessionSchema>;
