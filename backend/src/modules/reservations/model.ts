import { Schema, model, type Document, type Types } from 'mongoose';

export type ReservationStatus = 'PENDING' | 'CONFIRMED' | 'SEATED' | 'CANCELLED' | 'NO_SHOW';
export type ReservationChannel = 'TELEGRAM' | 'WEB' | 'WHATSAPP' | 'DASHBOARD';

export interface IReservation extends Document {
  tenantId: Types.ObjectId;
  branchId: Types.ObjectId;
  tableId?: Types.ObjectId;
  customerId?: Types.ObjectId;
  customerName: string;
  customerPhone: string;
  partySize: number;
  reservedFor: Date;
  channel: ReservationChannel;
  status: ReservationStatus;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ReservationSchema = new Schema<IReservation>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    tableId: { type: Schema.Types.ObjectId, ref: 'Table' },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer' },
    customerName: { type: String, required: true, trim: true },
    customerPhone: { type: String, required: true, trim: true },
    partySize: { type: Number, required: true, min: 1 },
    reservedFor: { type: Date, required: true, index: true },
    channel: {
      type: String,
      enum: ['TELEGRAM', 'WEB', 'WHATSAPP', 'DASHBOARD'],
      default: 'TELEGRAM',
    },
    status: {
      type: String,
      enum: ['PENDING', 'CONFIRMED', 'SEATED', 'CANCELLED', 'NO_SHOW'],
      default: 'PENDING',
    },
    notes: { type: String },
  },
  { timestamps: true }
);

ReservationSchema.index({ tenantId: 1, branchId: 1, reservedFor: 1 });
ReservationSchema.index({ tenantId: 1, status: 1 });

export const ReservationModel = model<IReservation>('Reservation', ReservationSchema);
