import { Schema, model, type Document, type Types } from 'mongoose';

export type TableStatus = 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'BILL_REQUESTED';

export interface ITable extends Document {
  tenantId: Types.ObjectId;
  branchId: Types.ObjectId;
  number: number;
  capacity: number;
  status: TableStatus;
  qrCodeToken: string;
  currentOrderId?: Types.ObjectId;
  totalOrdersServed: number;
  createdAt: Date;
  updatedAt: Date;
}

const TableSchema = new Schema<ITable>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    number: { type: Number, required: true },
    capacity: { type: Number, default: 4 },
    status: {
      type: String,
      enum: ['AVAILABLE', 'OCCUPIED', 'RESERVED', 'BILL_REQUESTED'],
      default: 'AVAILABLE',
    },
    qrCodeToken: { type: String, required: true, unique: true },
    currentOrderId: { type: Schema.Types.ObjectId, ref: 'Order' },
    totalOrdersServed: { type: Number, default: 0 },
  },
  { timestamps: true },
);

TableSchema.index({ tenantId: 1, branchId: 1, number: 1 }, { unique: true });
TableSchema.index({ tenantId: 1, branchId: 1, status: 1 });
export const TableModel = model<ITable>('Table', TableSchema);
