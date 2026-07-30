import type { Request, Response, NextFunction } from 'express';
import { CustomerService } from './service.js';
import { createCustomerSchema, updateCustomerSchema } from './validation.js';

const service = new CustomerService();

export async function createCustomerHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.tenantId ?? '';
    const validated = createCustomerSchema.parse(req.body);
    const c = await service.createCustomer(tenantId, validated);
    res.status(201).json({ success: true, data: c });
  } catch (err) {
    next(err);
  }
}

export async function listCustomersHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.tenantId ?? '';
    const customers = await service.listCustomers(tenantId);
    res.status(200).json({ success: true, data: customers });
  } catch (err) {
    next(err);
  }
}

export async function getCustomerHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.tenantId ?? '';
    const id = String(req.params['id'] ?? '');
    const c = await service.getCustomer(tenantId, id);
    res.status(200).json({ success: true, data: c });
  } catch (err) {
    next(err);
  }
}

export async function updateCustomerHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.tenantId ?? '';
    const id = String(req.params['id'] ?? '');
    const validated = updateCustomerSchema.parse(req.body);
    const c = await service.updateCustomer(tenantId, id, validated);
    res.status(200).json({ success: true, data: c });
  } catch (err) {
    next(err);
  }
}

export async function deleteCustomerHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.tenantId ?? '';
    const id = String(req.params['id'] ?? '');
    await service.deleteCustomer(tenantId, id);
    res.status(200).json({ success: true, message: 'Customer deleted successfully' });
  } catch (err) {
    next(err);
  }
}
