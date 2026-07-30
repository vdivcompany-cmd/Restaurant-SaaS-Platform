import type { Request, Response, NextFunction } from 'express';
import { FeedbackService } from './service.js';
import { createFeedbackSchema } from './validation.js';

const service = new FeedbackService();

export async function createFeedbackHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.tenantId ?? '';
    const validated = createFeedbackSchema.parse(req.body);
    const fb = await service.createFeedback(tenantId, validated);
    res.status(201).json({ success: true, data: fb });
  } catch (err) {
    next(err);
  }
}

export async function listFeedbackHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.tenantId ?? '';
    const branchId = typeof req.query['branchId'] === 'string' ? req.query['branchId'] : undefined;
    const feedbackList = await service.listFeedback(tenantId, branchId);
    res.status(200).json({ success: true, data: feedbackList });
  } catch (err) {
    next(err);
  }
}
