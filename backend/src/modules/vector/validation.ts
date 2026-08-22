import { z } from 'zod';

export const searchQuerySchema = z.object({
  q: z.string().min(1).max(500),
  topK: z.coerce.number().int().positive().max(20).default(5),
});

export const sessionSearchSchema = z.object({
  sessionId: z.string().min(1),
  query: z.string().min(1).max(500),
  topK: z.number().int().positive().max(20).optional(),
});

export type SearchQuery = z.infer<typeof searchQuerySchema>;
export type SessionSearchDto = z.infer<typeof sessionSearchSchema>;
