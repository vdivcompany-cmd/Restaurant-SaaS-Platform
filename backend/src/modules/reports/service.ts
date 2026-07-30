import { type PipelineStage, Types } from 'mongoose';
import { OrderModel } from '../orders/model.js';
import { tenantQuery } from '../../utils/tenantQuery.js';

export interface SalesReport {
  tenantId: string;
  branchId?: string | undefined;
  totalOrders: number;
  totalRevenue: number;
  paidOrders: number;
}

export class ReportService {
  public async generateSalesReport(tenantId: string, branchId?: string): Promise<SalesReport> {
    const pipeline: PipelineStage[] = [];

    if (branchId) {
      const matchBranch = Types.ObjectId.isValid(branchId)
        ? { $in: [branchId, new Types.ObjectId(branchId)] }
        : branchId;
      pipeline.push({ $match: { branchId: matchBranch } });
    }

    pipeline.push({
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalRevenue: {
          $sum: {
            $cond: [{ $eq: ['$status', 'PAID'] }, '$totalAmount', 0],
          },
        },
        paidOrders: {
          $sum: {
            $cond: [{ $eq: ['$status', 'PAID'] }, 1, 0],
          },
        },
      },
    });

    const results = await tenantQuery.aggregate(OrderModel, tenantId, pipeline).exec();
    const stats = (results[0] as { totalOrders: number; totalRevenue: number; paidOrders: number } | undefined) ?? {
      totalOrders: 0,
      totalRevenue: 0,
      paidOrders: 0,
    };

    return {
      tenantId,
      branchId,
      totalOrders: stats.totalOrders,
      totalRevenue: stats.totalRevenue,
      paidOrders: stats.paidOrders,
    };
  }
}
