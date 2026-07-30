import { Schema, model, type Document, type Types } from 'mongoose';

export interface IFeedback extends Document {
  tenantId: Types.ObjectId;
  branchId: Types.ObjectId;
  orderId?: Types.ObjectId;
  rating: number; // 1 to 5 stars
  comment?: string;
  customerName?: string;
  createdAt: Date;
  updatedAt: Date;
}

const FeedbackSchema = new Schema<IFeedback>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order' },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String },
    customerName: { type: String },
  },
  { timestamps: true },
);

FeedbackSchema.index({ tenantId: 1, branchId: 1, rating: 1 });
export const FeedbackModel = model<IFeedback>('Feedback', FeedbackSchema);
