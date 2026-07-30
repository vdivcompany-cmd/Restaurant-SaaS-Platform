import { Schema, model, type Document, type Types } from 'mongoose';

export interface IEmployee extends Document {
  tenantId: Types.ObjectId;
  branchId: Types.ObjectId;
  fullName: string;
  position: string;
  phone: string;
  hourlyRate: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const EmployeeSchema = new Schema<IEmployee>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    fullName: { type: String, required: true },
    position: { type: String, required: true },
    phone: { type: String, required: true },
    hourlyRate: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

EmployeeSchema.index({ tenantId: 1, branchId: 1, isActive: 1 });
export const EmployeeModel = model<IEmployee>('Employee', EmployeeSchema);
