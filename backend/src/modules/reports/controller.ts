import type { Request, Response, NextFunction } from 'express';
import { ReportService } from './service.js';
import { ordersByTableDailyQuerySchema, salesReportQuerySchema } from './validation.js';

const service = new ReportService();

export async function getSalesReportHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.tenantId ?? '';
    const validated = salesReportQuerySchema.parse(req.query);
    const report = await service.generateSalesReport(tenantId, validated.branchId);
    res.status(200).json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
}

export async function getOrdersHistoryByTableHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.tenantId ?? '';
    const validated = ordersByTableDailyQuerySchema.parse(req.query);
    const startDate = validated.startDate ? new Date(validated.startDate) : undefined;
    const endDate = validated.endDate ? new Date(validated.endDate) : undefined;
    const result = await service.getOrdersHistoryByTable(tenantId, validated.branchId, startDate, endDate);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}
