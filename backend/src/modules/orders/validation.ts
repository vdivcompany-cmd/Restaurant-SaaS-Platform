import { z } from 'zod';
import { objectIdSchema } from '../../shared/validation/index.js';

export const createOrderSchema = z.object({
  branchId: objectIdSchema.optional(),
  channel: z.enum(['DINE_IN', 'TAKEAWAY', 'DELIVERY', 'QR', 'WEB', 'TELEGRAM']).optional().default('DINE_IN'),
  tableId: objectIdSchema.optional(),
  customerId: objectIdSchema.optional(),
  customerName: z.string().min(2).max(100).optional(),
  customerPhone: z.string().min(6).max(25).optional(),
  items: z.array(
    z.object({
      productId: objectIdSchema,
      name: z.string().min(1),
      quantity: z.number().int().min(1),
      unitPrice: z.number().min(0),
      totalPrice: z.number().min(0),
      selectedVariants: z.array(
        z.object({
          variantId: objectIdSchema.optional(),
          variantName: z.string().optional(),
          selectedOptionNames: z.array(z.string()).optional(),
          priceDelta: z.number().optional().default(0),
        })
      ).optional().default([]),
      notes: z.string().optional(),
    })
  ).min(1, 'Order must contain at least one item'),
  subtotal: z.number().min(0),
  taxAmount: z.number().min(0).optional().default(0),
  totalAmount: z.number().min(0),
  offlineGuid: z.string().optional(),
  tableSessionId: z.string().uuid().optional(),
}).refine(
  (data) => (data.channel === 'DINE_IN' ? Boolean(data.tableId) : true),
  { message: 'tableId is required when channel is DINE_IN', path: ['tableId'] }
);

/**
 * Schema for public customer self-service orders (takeaway / delivery).
 * Requires customerName + customerPhone for lightweight identity.
 * Rejects DINE_IN channel — QR dine-in orders use the /qr route instead.
 */
export const createCustomerOrderSchema = z.object({
  branchId: objectIdSchema.optional(),
  channel: z.enum(['TAKEAWAY', 'DELIVERY']),
  customerName: z.string().min(2).max(100),
  customerPhone: z.string().min(6).max(25),
  items: z.array(
    z.object({
      productId: objectIdSchema,
      name: z.string().min(1),
      quantity: z.number().int().min(1),
      unitPrice: z.number().min(0),
      totalPrice: z.number().min(0),
      selectedVariants: z.array(
        z.object({
          variantId: objectIdSchema.optional(),
          variantName: z.string().optional(),
          selectedOptionNames: z.array(z.string()).optional(),
          priceDelta: z.number().optional().default(0),
        })
      ).optional().default([]),
      notes: z.string().optional(),
    })
  ).min(1, 'Order must contain at least one item'),
  subtotal: z.number().min(0),
  taxAmount: z.number().min(0).optional().default(0),
  totalAmount: z.number().min(0),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(['PENDING', 'PREPARING', 'READY', 'SERVED', 'PAID', 'CANCELLED']),
});

export const offlineSyncSchema = z.object({
  branchId: objectIdSchema.optional(),
  orders: z.array(createOrderSchema).min(1, 'At least one offline order is required for synchronization'),
});

export type CreateOrderDto = z.infer<typeof createOrderSchema>;
export type CreateCustomerOrderDto = z.infer<typeof createCustomerOrderSchema>;
export type UpdateOrderStatusDto = z.infer<typeof updateOrderStatusSchema>;
export type OfflineSyncDto = z.infer<typeof offlineSyncSchema>;

