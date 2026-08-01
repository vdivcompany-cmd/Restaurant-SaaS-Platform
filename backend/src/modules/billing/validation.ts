import { z } from 'zod';
import { objectIdSchema } from '../../shared/validation/index.js';

export const CreateBillingRecordSchema = z.object({
  tenantId: objectIdSchema.describe('Target tenant ID (super_admin only)'),
  subscriptionId: z.string().optional(),
  amount: z.number().positive('Amount must be positive'),
  currency: z.string().default('EGP'),
  status: z.enum(['pending', 'paid', 'failed', 'refunded']).default('pending'),
  provider: z.string().optional(),
  providerRef: z.string().optional(),
});

export type CreateBillingRecordInput = z.infer<typeof CreateBillingRecordSchema>;
