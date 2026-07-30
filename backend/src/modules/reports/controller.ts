import type { Request, Response, NextFunction } from 'express';
import { ReportService } from './service.js';

const service = new ReportService();

export async function getSalesReportHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.tenantId ?? '';
    const branchId = typeof req.query['branchId'] === 'string' ? req.query['branchId'] : undefined;
    const report = await service.generateSalesReport(tenantId, branchId);
    res.status(200).json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
}
