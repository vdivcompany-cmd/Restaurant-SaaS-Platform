import { z } from 'zod';

export const createOrderSchema = z.object({
  branchId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid branch ID'),
  channel: z.enum(['DINE_IN', 'TAKEAWAY', 'DELIVERY', 'QR', 'WEB', 'TELEGRAM']).optional().default('DINE_IN'),
  tableId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  items: z.array(
    z.object({
      productId: z.string().regex(/^[0-9a-fA-F]{24}$/),
      name: z.string().min(1),
      quantity: z.number().int().min(1),
      unitPrice: z.number().min(0),
      totalPrice: z.number().min(0),
    })
  ).min(1, 'Order must contain at least one item'),
  subtotal: z.number().min(0),
  taxAmount: z.number().min(0).optional().default(0),
  totalAmount: z.number().min(0),
  offlineGuid: z.string().optional(),
  tableSessionId: z.string().uuid().optional(),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(['PENDING', 'PREPARING', 'READY', 'SERVED', 'PAID', 'CANCELLED']),
});

export const offlineSyncSchema = z.object({
  branchId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid branch ID'),
  orders: z.array(createOrderSchema).min(1, 'At least one offline order is required for synchronization'),
});

export type CreateOrderDto = z.infer<typeof createOrderSchema>;
export type UpdateOrderStatusDto = z.infer<typeof updateOrderStatusSchema>;
export type OfflineSyncDto = z.infer<typeof offlineSyncSchema>;
