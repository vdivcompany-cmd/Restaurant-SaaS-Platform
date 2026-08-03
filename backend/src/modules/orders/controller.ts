import type { Request, Response, NextFunction } from 'express';
import { OrderService } from './service.js';
import { createOrderSchema, updateOrderStatusSchema, offlineSyncSchema } from './validation.js';

const service = new OrderService();

export async function createOrderHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.tenantId ?? '';
    const validated = createOrderSchema.parse(req.body);
    const isStaffInitiated = Boolean(req.user);
    const order = await service.createOrder(tenantId, validated, { skipSessionCheck: isStaffInitiated });
    res.status(201).json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
}

export async function createQrOrderHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.tenantId ?? '';
    const validated = createOrderSchema.parse(req.body);
    // Unauthenticated public customer order — session check MUST run (skipSessionCheck defaults to false)
    const order = await service.createOrder(tenantId, { ...validated, channel: validated.channel ?? 'QR' });
    res.status(201).json({ success: true, data: order });
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
    const branchId = typeof req.query['branchId'] === 'string' ? req.query['branchId'] : undefined;
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
