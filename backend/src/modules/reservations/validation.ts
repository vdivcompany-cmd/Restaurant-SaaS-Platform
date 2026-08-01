import { z } from 'zod';
import { objectIdSchema, phoneSchema } from '../../shared/validation/index.js';

export const CreateReservationSchema = z.object({
  tenantId: objectIdSchema,
  branchId: objectIdSchema,
  tableId: objectIdSchema.optional(),
  customerId: objectIdSchema.optional(),
  customerName: z.string().min(2).max(100),
  customerPhone: phoneSchema,
  partySize: z.number().int().min(1).max(100),
  reservedFor: z.string().datetime().refine(
    (dateStr) => new Date(dateStr) > new Date(),
    'Reservation time must be in the future'
  ),
  channel: z.enum(['TELEGRAM', 'WEB', 'WHATSAPP', 'DASHBOARD']).default('TELEGRAM'),
  notes: z.string().max(500).optional(),
});

export const UpdateReservationSchema = z.object({
  status: z.enum(['CONFIRMED', 'SEATED', 'CANCELLED', 'NO_SHOW']).optional(),
  tableId: objectIdSchema.optional(),
  notes: z.string().max(500).optional(),
});

export type CreateReservationInput = z.infer<typeof CreateReservationSchema>;
export type UpdateReservationInput = z.infer<typeof UpdateReservationSchema>;
