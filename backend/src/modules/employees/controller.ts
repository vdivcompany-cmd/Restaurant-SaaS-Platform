import type { Request, Response, NextFunction } from 'express';
import { EmployeeService } from './service.js';
import { createEmployeeSchema, updateEmployeeSchema } from './validation.js';

const service = new EmployeeService();

export async function createEmployeeHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.tenantId ?? '';
    const validated = createEmployeeSchema.parse(req.body);
    const emp = await service.createEmployee(tenantId, validated);
    res.status(201).json({ success: true, data: emp });
  } catch (err) {
    next(err);
  }
}

export async function listEmployeesHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.tenantId ?? '';
    const branchId = typeof req.query['branchId'] === 'string' ? req.query['branchId'] : undefined;
    const emps = await service.listEmployees(tenantId, branchId);
    res.status(200).json({ success: true, data: emps });
  } catch (err) {
    next(err);
  }
}

export async function getEmployeeHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.tenantId ?? '';
    const id = String(req.params['id'] ?? '');
    const emp = await service.getEmployee(tenantId, id);
    res.status(200).json({ success: true, data: emp });
  } catch (err) {
    next(err);
  }
}

export async function updateEmployeeHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.tenantId ?? '';
    const id = String(req.params['id'] ?? '');
    const validated = updateEmployeeSchema.parse(req.body);
    const emp = await service.updateEmployee(tenantId, id, validated);
    res.status(200).json({ success: true, data: emp });
  } catch (err) {
    next(err);
  }
}

export async function deleteEmployeeHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.tenantId ?? '';
    const id = String(req.params['id'] ?? '');
    await service.deleteEmployee(tenantId, id);
    res.status(200).json({ success: true, message: 'Employee deleted successfully' });
  } catch (err) {
    next(err);
  }
}
