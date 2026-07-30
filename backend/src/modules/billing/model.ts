import { Schema, model, type Document, type Types } from 'mongoose';

export type BillingStatus = 'pending' | 'paid' | 'failed' | 'refunded';

export interface IBillingRecord extends Document {
  tenantId: Types.ObjectId | string;
  subscriptionId?: Types.ObjectId | string | undefined;
  amount: number;
  currency: string;
  status: BillingStatus;
  provider?: string | undefined;
  providerRef?: string | undefined;
  createdAt: Date;
  updatedAt: Date;
}

const billingRecordSchema = new Schema<IBillingRecord>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    subscriptionId: { type: Schema.Types.ObjectId, ref: 'Subscription' },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'EGP' },
    status: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded'],
      default: 'pending',
      required: true,
    },
    provider: { type: String, default: 'paymob' },
    providerRef: { type: String },
  },
  {
    timestamps: true,
  }
);

billingRecordSchema.index({ tenantId: 1, createdAt: -1 });

export const BillingRecordModel = model<IBillingRecord>('BillingRecord', billingRecordSchema);
