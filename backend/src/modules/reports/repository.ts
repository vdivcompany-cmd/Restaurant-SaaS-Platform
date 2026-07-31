import { ReportSnapshotModel, type IReportSnapshot } from './model.js';
import { tenantQuery } from '../../utils/tenantQuery.js';

export class ReportRepository {
  public static async saveSnapshot(data: Partial<IReportSnapshot>): Promise<IReportSnapshot> {
    const snapshot = new ReportSnapshotModel(data);
    return await snapshot.save();
  }

  public static async getLatestSnapshots(
    tenantId: string,
    reportType?: 'DAILY_SALES' | 'SHIFT_RECONCILIATION' | 'WEEKLY_AI_ADVISOR' | 'TAX_SUMMARY',
    limit: number = 30
  ): Promise<IReportSnapshot[]> {
    const filter = reportType ? { reportType } : {};
    return await tenantQuery.find(ReportSnapshotModel, tenantId, filter).sort({ periodEnd: -1 }).limit(limit).exec();
  }

  public static async findSnapshotByPeriod(tenantId: string, start: Date, end: Date): Promise<IReportSnapshot | null> {
    const filter = {
      periodStart: { $gte: start.getTime() },
      periodEnd: { $lte: end.getTime() }
    };
    return await tenantQuery.findOne(ReportSnapshotModel, tenantId, filter).exec();
  }
}
