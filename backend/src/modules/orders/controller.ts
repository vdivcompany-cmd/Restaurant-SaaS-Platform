import type { Request, Response, NextFunction } from 'express';
import { OrderService } from './service.js';
import {
  createOrderSchema,
  createCustomerOrderSchema,
  createPublicQrOrderSchema,
  updateOrderStatusSchema,
  cashierConfirmSchema,
  kitchenCompleteSchema,
  offlineSyncSchema,
} from './validation.js';
import { priceOrderItems } from '../menu/pricing.service.js';
import { objectIdSchema } from '../../shared/validation/index.js';
import { TableModel } from '../tables/model.js';

const service = new OrderService();

export async function createOrderHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.tenantId ?? '';
    const normalizedBody = req.body?.channel === 'QR' ? { ...req.body, channel: 'DINE_IN' } : req.body;
    const validated = createOrderSchema.parse(normalizedBody);
    const isStaffInitiated = Boolean(req.user);
    const order = await service.createOrder(tenantId, validated, { skipSessionCheck: isStaffInitiated });
    res.status(201).json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
}

export async function createQrOrderHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.tenantId || (req.body?.tenantId as string) || '';
    const validated = createPublicQrOrderSchema.parse(req.body);

    const rawItems: import('../menu/pricing.service.js').PricedOrderItemInput[] = validated.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      ...(item.variantId !== undefined ? { variantId: item.variantId } : {}),
      ...(item.selectedOptionNames?.length ? { selectedOptionNames: item.selectedOptionNames } : {}),
      ...(item.notes !== undefined ? { notes: item.notes } : {}),
    }));

    // Server computes every price — client only supplied productId/quantity/variant
    const priced = await priceOrderItems(tenantId, rawItems);

    let tableNumber = validated.tableNumber;
    if (!tableNumber && validated.tableId) {
      const table = await TableModel.findById(validated.tableId).lean();
      if (table) tableNumber = (table as any).number;
    }

    const order = await service.createOrder(tenantId, {
      branchId: validated.branchId,
      channel: 'DINE_IN',
      tableId: validated.tableId,
      tableNumber,
      tableSessionId: validated.tableSessionId,
      customer: validated.customer,
      customerName: validated.customerName,
      customerPhone: validated.customerPhone,
      couponCode: validated.couponCode,
      items: priced.items,
      subtotal: priced.subtotal,
      taxAmount: 0,
      totalAmount: priced.totalAmount,
    } as any);

    res.status(201).json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
}

/**
 * Public self-service order handler for takeaway / delivery customers.
 * Customer is identified by name + phone (no JWT required).
 * Server calculates all prices securely via priceOrderItems.
 * Channel is restricted to TAKEAWAY or DELIVERY.
 */
export async function createCustomerOrderHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.tenantId || (req.body?.tenantId as string) || '';
    const validated = createCustomerOrderSchema.parse(req.body);

    const rawItems: import('../menu/pricing.service.js').PricedOrderItemInput[] = validated.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      ...(item.variantId !== undefined ? { variantId: item.variantId } : {}),
      ...(item.selectedOptionNames?.length ? { selectedOptionNames: item.selectedOptionNames } : {}),
      ...(item.notes !== undefined ? { notes: item.notes } : {}),
    }));

    // Server computes every price — client/AI only provides productId/quantity/variants
    const priced = await priceOrderItems(tenantId, rawItems);

    const order = await service.createCustomerOrder(tenantId, {
      branchId: validated.branchId,
      channel: validated.channel,
      customer: validated.customer,
      customerName: validated.customerName,
      customerPhone: validated.customerPhone,
      customerEmail: validated.customerEmail,
      couponCode: validated.couponCode,
      ...(validated.deliveryAddress ? { deliveryAddress: validated.deliveryAddress } : {}),
      items: priced.items,
      subtotal: priced.subtotal,
      taxAmount: 0,
      totalAmount: priced.totalAmount,
    } as any);

    res.status(201).json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
}

export async function confirmCashierOrderHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.tenantId ?? '';
    const orderId = String(req.params['id'] ?? '');
    const validated = cashierConfirmSchema.parse(req.body);
    const cashierUserId = (req.user as any)?.id || (req.user as any)?._id?.toString();
    const order = await service.confirmByCashier(tenantId, orderId, cashierUserId, validated);
    res.status(200).json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
}

export async function completeKitchenOrderHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.tenantId ?? '';
    const orderId = String(req.params['id'] ?? '');
    const validated = kitchenCompleteSchema.parse(req.body);
    const kitchenUserId = (req.user as any)?.id || (req.user as any)?._id?.toString();
    const order = await service.completeByKitchen(tenantId, orderId, kitchenUserId, validated);
    res.status(200).json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
}

export async function completeOrderHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.tenantId ?? '';
    const orderId = String(req.params['id'] ?? '');
    const order = await service.completeOrder(tenantId, orderId);
    res.status(200).json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
}

export async function syncOfflineOrdersHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.tenantId ?? '';
    const validated = offlineSyncSchema.parse(req.body);
    const result = await service.syncOfflineOrders(tenantId, validated);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function listOrdersHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.tenantId ?? '';
    const rawBranchId = req.query['branchId'];
    const branchId = typeof rawBranchId === 'string' && rawBranchId ? objectIdSchema.parse(rawBranchId) : undefined;
    const orders = await service.listOrders(tenantId, branchId);
    res.status(200).json({ success: true, data: orders });
  } catch (err) {
    next(err);
  }
}

export async function getOrderHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.tenantId ?? '';
    const orderId = String(req.params['id'] ?? '');
    const order = await service.getOrder(tenantId, orderId);
    res.status(200).json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
}

export async function updateOrderStatusHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.tenantId ?? '';
    const orderId = String(req.params['id'] ?? '');
    const validated = updateOrderStatusSchema.parse(req.body);
    const order = await service.updateOrderStatus(tenantId, orderId, validated);
    res.status(200).json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
}

