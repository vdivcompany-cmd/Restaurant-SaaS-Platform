import { z } from 'zod';

export const createEmployeeSchema = z.object({
  branchId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid branch ID'),
  fullName: z.string().min(2).max(100),
  position: z.string().min(2).max(100),
  phone: z.string().min(6).max(25),
  hourlyRate: z.number().min(0).optional().default(0),
  isActive: z.boolean().optional().default(true),
});

export const updateEmployeeSchema = createEmployeeSchema.partial();
export type CreateEmployeeDto = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeDto = z.infer<typeof updateEmployeeSchema>;
