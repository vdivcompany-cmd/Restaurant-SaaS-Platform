import { Schema, model, type Document, type Types } from 'mongoose';

export type CouponDiscountType = 'PERCENTAGE' | 'FIXED';

export interface ICoupon extends Document {
  tenantId: Types.ObjectId;
  code: string;
  discountType: CouponDiscountType;
  discountValue: number;
  discountPercentage?: number; // Maintained for backward-compatibility
  minOrderAmount?: number;
  maxDiscountCap?: number;
  usageLimit?: number;
  timesUsed: number;
  expiresAt: Date;
  isActive: boolean;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CouponSchema = new Schema<ICoupon>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    code: { type: String, required: true, uppercase: true, trim: true },
    discountType: { type: String, enum: ['PERCENTAGE', 'FIXED'], default: 'PERCENTAGE' },
    discountValue: { type: Number, required: true, min: 0 },
    discountPercentage: { type: Number, min: 1, max: 100 },
    minOrderAmount: { type: Number, min: 0, default: 0 },
    maxDiscountCap: { type: Number, min: 0 },
    usageLimit: { type: Number, min: 1 },
    timesUsed: { type: Number, default: 0, min: 0 },
    expiresAt: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

CouponSchema.index({ tenantId: 1, code: 1 }, { unique: true });
CouponSchema.index({ tenantId: 1, isActive: 1, expiresAt: 1 });

export const CouponModel = model<ICoupon>('Coupon', CouponSchema);

