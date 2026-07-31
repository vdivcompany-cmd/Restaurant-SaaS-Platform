import { Schema, model, type Document } from 'mongoose';

export interface INotificationLog extends Document {
  tenantId: Schema.Types.ObjectId;
  channel: 'EMAIL' | 'TELEGRAM' | 'SMS' | 'WHATSAPP';
  recipient: string;
  messageSubject?: string;
  messageBody: string;
  status: 'QUEUED' | 'SENT' | 'FAILED';
  errorMessage?: string;
  dispatchedAt: Date;
  createdAt: Date;
}

const notificationLogSchema = new Schema<INotificationLog>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    channel: { type: String, enum: ['EMAIL', 'TELEGRAM', 'SMS', 'WHATSAPP'], required: true },
    recipient: { type: String, required: true, trim: true },
    messageSubject: { type: String, trim: true },
    messageBody: { type: String, required: true },
    status: { type: String, enum: ['QUEUED', 'SENT', 'FAILED'], default: 'QUEUED', index: true },
    errorMessage: { type: String },
    dispatchedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

notificationLogSchema.index({ tenantId: 1, dispatchedAt: -1 });

export const NotificationLogModel = model<INotificationLog>('NotificationLog', notificationLogSchema);
