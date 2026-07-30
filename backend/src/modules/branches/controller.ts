import type { Request, Response, NextFunction } from 'express';
import { BranchService } from './service.js';
import { createBranchSchema, updateBranchSchema } from './validation.js';

const service = new BranchService();

export async function createBranchHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.tenantId ?? '';
    const validated = createBranchSchema.parse(req.body);
    const branch = await service.createBranch(tenantId, validated);
    res.status(201).json({ success: true, data: branch });
  } catch (err) {
    next(err);
  }
}

export async function listBranchesHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.tenantId ?? '';
    const branches = await service.listBranches(tenantId);
    res.status(200).json({ success: true, data: branches });
  } catch (err) {
    next(err);
  }
}

export async function getBranchHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.tenantId ?? '';
    const id = String(req.params['id'] ?? '');
    const branch = await service.getBranch(tenantId, id);
    res.status(200).json({ success: true, data: branch });
  } catch (err) {
    next(err);
  }
}

export async function updateBranchHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.tenantId ?? '';
    const id = String(req.params['id'] ?? '');
    const validated = updateBranchSchema.parse(req.body);
    const branch = await service.updateBranch(tenantId, id, validated);
    res.status(200).json({ success: true, data: branch });
  } catch (err) {
    next(err);
  }
}

export async function deleteBranchHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.tenantId ?? '';
    const id = String(req.params['id'] ?? '');
    await service.deleteBranch(tenantId, id);
    res.status(200).json({ success: true, message: 'Branch deleted successfully' });
  } catch (err) {
    next(err);
  }
}
