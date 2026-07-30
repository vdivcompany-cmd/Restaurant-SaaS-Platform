import { z } from 'zod';

export const createTableSchema = z.object({
  branchId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid branch ID'),
  number: z.number().int().min(1),
  capacity: z.number().int().min(1).optional().default(4),
  status: z.enum(['AVAILABLE', 'OCCUPIED', 'RESERVED', 'BILL_REQUESTED']).optional().default('AVAILABLE'),
});

export const updateTableSchema = z.object({
  number: z.number().int().min(1).optional(),
  capacity: z.number().int().min(1).optional(),
  status: z.enum(['AVAILABLE', 'OCCUPIED', 'RESERVED', 'BILL_REQUESTED']).optional(),
  currentOrderId: z.string().regex(/^[0-9a-fA-F]{24}$/).nullable().optional(),
});

export type CreateTableDto = z.infer<typeof createTableSchema>;
export type UpdateTableDto = z.infer<typeof updateTableSchema>;
