import { z } from 'zod';

export const searchQuerySchema = z.object({
  q: z.string().min(1).max(500),
  topK: z.coerce.number().int().positive().max(20).default(5),
});

export const sessionSearchSchema = z
  .object({
    sessionId: z.string().min(1).optional(),
    tenantId: z.string().min(1).optional(),
    query: z.string().min(1).max(500),
    topK: z.number().int().positive().max(20).optional(),
  })
  .refine((data) => Boolean(data.sessionId || data.tenantId), {
    message: 'Either sessionId or tenantId must be provided',
  });

export type SearchQuery = z.infer<typeof searchQuerySchema>;
export type SessionSearchDto = z.infer<typeof sessionSearchSchema>;
