import { Schema, model, type Document, type Types } from 'mongoose';

export interface ICoupon extends Document {
  tenantId: Types.ObjectId;
  code: string;
  discountPercentage: number;
  expiresAt: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CouponSchema = new Schema<ICoupon>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    code: { type: String, required: true, uppercase: true },
    discountPercentage: { type: Number, required: true, min: 1, max: 100 },
    expiresAt: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

CouponSchema.index({ tenantId: 1, code: 1 }, { unique: true });
export const CouponModel = model<ICoupon>('Coupon', CouponSchema);
