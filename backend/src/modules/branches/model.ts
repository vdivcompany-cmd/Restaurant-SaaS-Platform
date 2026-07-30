import { Schema, model, type Document, type Types } from 'mongoose';

export interface IBranch extends Document {
  tenantId: Types.ObjectId;
  name: string;
  slug: string;
  address: string;
  phone: string;
  isActive: boolean;
  tableCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const BranchSchema = new Schema<IBranch>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    name: { type: String, required: true },
    slug: { type: String, required: true },
    address: { type: String, required: true },
    phone: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    tableCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

BranchSchema.index({ tenantId: 1, slug: 1 }, { unique: true });
BranchSchema.index({ tenantId: 1, isActive: 1 });

export const BranchModel = model<IBranch>('Branch', BranchSchema);
