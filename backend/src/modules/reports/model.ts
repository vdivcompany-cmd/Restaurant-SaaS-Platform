import { Schema, model, type Document } from 'mongoose';

export interface IReportSnapshot extends Document {
  tenantId: Schema.Types.ObjectId;
  branchId?: Schema.Types.ObjectId;
  reportType: 'DAILY_SALES' | 'SHIFT_RECONCILIATION' | 'WEEKLY_AI_ADVISOR' | 'TAX_SUMMARY';
  periodStart: Date;
  periodEnd: Date;
  metrics: {
    totalRevenue: number;
    totalOrders: number;
    averageOrderValue: number;
    paymentBreakdown?: Record<string, number>;
    topDishes?: Array<{ dishName: string; quantity: number; revenue: number }>;
  };
  aiInsightNotes?: string;
  generatedBy?: Schema.Types.ObjectId;
  createdAt: Date;
}

const reportSnapshotSchema = new Schema<IReportSnapshot>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', index: true },
    reportType: {
      type: String,
      enum: ['DAILY_SALES', 'SHIFT_RECONCILIATION', 'WEEKLY_AI_ADVISOR', 'TAX_SUMMARY'],
      required: true,
      index: true,
    },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    metrics: {
      totalRevenue: { type: Number, required: true, default: 0 },
      totalOrders: { type: Number, required: true, default: 0 },
      averageOrderValue: { type: Number, required: true, default: 0 },
      paymentBreakdown: { type: Schema.Types.Mixed },
      topDishes: [{ dishName: String, quantity: Number, revenue: Number }],
    },
    aiInsightNotes: { type: String, trim: true },
    generatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

reportSnapshotSchema.index({ tenantId: 1, reportType: 1, periodEnd: -1 });

export const ReportSnapshotModel = model<IReportSnapshot>('ReportSnapshot', reportSnapshotSchema);
