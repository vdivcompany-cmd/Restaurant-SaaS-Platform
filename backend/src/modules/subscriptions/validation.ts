import { z } from 'zod';
import { objectIdSchema } from '../../shared/validation/index.js';

export const GetSubscriptionSchema = z.object({});

export const UpdateSubscriptionSchema = z.object({
  tenantId: objectIdSchema.describe('Target tenant ID (super_admin only)'),
  plan: z.enum(['free', 'starter', 'pro', 'enterprise']),
  status: z.enum(['active', 'trialing', 'past_due', 'canceled', 'expired']).optional(),
  expiresAt: z.string().datetime().optional(),
});

export type UpdateSubscriptionInput = z.infer<typeof UpdateSubscriptionSchema>;
