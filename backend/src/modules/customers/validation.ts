import { z } from 'zod';

export const createCustomerSchema = z.object({
  name: z.string().min(2).max(100),
  phone: z.string().min(6).max(25),
  email: z.string().email().optional(),
});

export const updateCustomerSchema = createCustomerSchema.partial();
export type CreateCustomerDto = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerDto = z.infer<typeof updateCustomerSchema>;
