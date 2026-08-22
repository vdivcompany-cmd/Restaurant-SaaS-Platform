import { z } from 'zod';
import { objectIdSchema } from '../../shared/validation/index.js';

export const publicOrderItemSchema = z.object({
  productId: objectIdSchema,
  quantity: z.number().int().min(1).max(50),
  variantId: objectIdSchema.optional(),
  selectedOptionNames: z.array(z.string()).optional().default([]),
  notes: z.string().max(300).optional(),
}).strict();

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
  deliveryAddress: z.string().optional(),
}).refine(
  (data) => (data.channel === 'DINE_IN' ? Boolean(data.tableId) : true),
  { message: 'tableId is required when channel is DINE_IN', path: ['tableId'] }
);

/**
 * Schema for public customer self-service orders (takeaway / delivery).
 * Requires customerName + customerPhone for lightweight identity.
 * Uses publicOrderItemSchema where server calculates prices securely.
 * Rejects DINE_IN channel — QR dine-in orders use the /qr route instead.
 */
export const createCustomerOrderSchema = z.object({
  tenantId: objectIdSchema.optional(),
  branchId: objectIdSchema.optional(),
  channel: z.enum(['TAKEAWAY', 'DELIVERY']),
  customerName: z.string().min(2, 'Name must be at least 2 characters').max(100),
  customerPhone: z.string().min(6, 'Phone must be at least 6 digits').max(25),
  deliveryAddress: z.string().min(5, 'Delivery address must be at least 5 characters').max(300).optional(),
  notes: z.string().max(300).optional(),
  items: z.array(publicOrderItemSchema).min(1, 'Order must contain at least one item'),
}).refine(
  (data) => (data.channel === 'DELIVERY' ? Boolean(data.deliveryAddress && data.deliveryAddress.trim().length >= 5) : true),
  { message: 'deliveryAddress is required for DELIVERY orders', path: ['deliveryAddress'] }
);

export const createPublicQrOrderSchema = z.object({
  tenantId: objectIdSchema,
  branchId: objectIdSchema,
  tableId: objectIdSchema,
  tableSessionId: z.string().uuid(),
  items: z.array(publicOrderItemSchema).min(1, 'Order must contain at least one item'),
}).strict();

export const updateOrderStatusSchema = z.object({
  status: z.enum(['PENDING', 'PREPARING', 'READY', 'SERVED', 'PAID', 'CANCELLED']),
});

export const offlineSyncSchema = z.object({
  branchId: objectIdSchema.optional(),
  orders: z.array(createOrderSchema).min(1, 'At least one offline order is required for synchronization'),
});

export type PublicOrderItemDto = z.infer<typeof publicOrderItemSchema>;
export type CreateOrderDto = z.infer<typeof createOrderSchema>;
export type CreateCustomerOrderDto = z.infer<typeof createCustomerOrderSchema>;
export type CreatePublicQrOrderDto = z.infer<typeof createPublicQrOrderSchema>;
export type UpdateOrderStatusDto = z.infer<typeof updateOrderStatusSchema>;
export type OfflineSyncDto = z.infer<typeof offlineSyncSchema>;
