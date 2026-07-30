import { z } from 'zod';

export const GetSubscriptionSchema = z.object({});

export const UpdateSubscriptionSchema = z.object({
  plan: z.enum(['free', 'starter', 'pro', 'enterprise']),
  status: z.enum(['active', 'trialing', 'past_due', 'canceled', 'expired']).optional(),
  expiresAt: z.string().datetime().optional(),
});

export type UpdateSubscriptionInput = z.infer<typeof UpdateSubscriptionSchema>;
