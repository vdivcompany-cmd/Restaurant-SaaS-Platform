import { z } from 'zod';
import { objectIdSchema } from '../../shared/validation/index.js';

export const salesReportQuerySchema = z.object({
  branchId: objectIdSchema.optional(),
  startDate: z.string().datetime({ message: 'Must be a valid ISO datetime' }).optional(),
  endDate: z.string().datetime({ message: 'Must be a valid ISO datetime' }).optional(),
});

export type SalesReportQuery = z.infer<typeof salesReportQuerySchema>;
