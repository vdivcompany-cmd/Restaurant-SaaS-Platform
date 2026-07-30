import { Schema, model, type Document, type Types } from 'mongoose';

export interface ICustomer extends Document {
  tenantId: Types.ObjectId;
  name: string;
  phone: string;
  email?: string;
  totalSpend: number;
  loyaltyPoints: number;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerSchema = new Schema<ICustomer>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String },
    totalSpend: { type: Number, default: 0 },
    loyaltyPoints: { type: Number, default: 0 },
  },
  { timestamps: true },
);

CustomerSchema.index({ tenantId: 1, phone: 1 }, { unique: true });
export const CustomerModel = model<ICustomer>('Customer', CustomerSchema);
