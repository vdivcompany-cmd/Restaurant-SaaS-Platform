import { type PipelineStage, Types } from 'mongoose';
import { OrderModel } from '../orders/model.js';
import { TableModel, type ITable } from '../tables/model.js';
import { tenantQuery } from '../../utils/tenantQuery.js';

export interface DailyTableOrdersBucket {
  date: string;
  tables: Array<{
    tableId: string | null;
    tableNumber: number | null;
    orderCount: number;
    totalRevenue: number;
  }>;
}

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
      const matchBranch = Types.ObjectId.isValid(branchId) ? new Types.ObjectId(branchId) : branchId;
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

  public async getOrdersHistoryByTable(
    tenantId: string,
    branchId?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{ tenantId: string; branchId?: string; days: DailyTableOrdersBucket[] }> {
    const pipeline: PipelineStage[] = [];

    const matchStage: Record<string, unknown> = {};
    if (branchId) {
      matchStage['branchId'] = Types.ObjectId.isValid(branchId) ? new Types.ObjectId(branchId) : branchId;
    }
    if (startDate || endDate) {
      matchStage['createdAt'] = {
        ...(startDate ? { $gte: startDate } : {}),
        ...(endDate ? { $lte: endDate } : {}),
      };
    }
    if (Object.keys(matchStage).length > 0) {
      pipeline.push({ $match: matchStage });
    }

    pipeline.push({
      $group: {
        _id: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          tableId: '$tableId',
        },
        orderCount: { $sum: 1 },
        totalRevenue: {
          $sum: { $cond: [{ $eq: ['$status', 'PAID'] }, '$totalAmount', 0] },
        },
      },
    });
    pipeline.push({ $sort: { '_id.date': -1 } });

    const rows = (await tenantQuery.aggregate(OrderModel, tenantId, pipeline).exec() as unknown) as Array<{
      _id: { date: string; tableId: Types.ObjectId | null };
      orderCount: number;
      totalRevenue: number;
    }>;

    // Resolve table numbers in one pass (avoids N+1 lookups)
    const tableIds = [...new Set(
      rows.map((r) => r._id.tableId?.toString()).filter(Boolean)
    )] as string[];
    const tables = tableIds.length > 0
      ? await tenantQuery.find<ITable>(TableModel, tenantId, { _id: { $in: tableIds } }).exec()
      : [];
    const tableNumberById = new Map(tables.map((t) => [t._id.toString(), t.number]));

    const byDate = new Map<string, DailyTableOrdersBucket['tables']>();
    for (const row of rows) {
      const date = row._id.date;
      const tableIdStr = row._id.tableId ? row._id.tableId.toString() : null;
      const bucket = byDate.get(date) ?? [];
      bucket.push({
        tableId: tableIdStr,
        tableNumber: tableIdStr ? (tableNumberById.get(tableIdStr) ?? null) : null,
        orderCount: row.orderCount,
        totalRevenue: row.totalRevenue,
      });
      byDate.set(date, bucket);
    }

    const days: DailyTableOrdersBucket[] = [...byDate.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([date, tables]) => ({ date, tables }));

    return { tenantId, ...(branchId ? { branchId } : {}), days };
  }
}
