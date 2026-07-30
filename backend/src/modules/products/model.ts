import { Schema, model, type Document, type Types } from 'mongoose';

export interface IProduct extends Document {
  tenantId: Types.ObjectId;
  categoryId: Types.ObjectId;
  name: string;
  description?: string;
  basePrice: number;
  imageUrl?: string;
  isAvailable: boolean;
  variantIds: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema<IProduct>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
    name: { type: String, required: true },
    description: { type: String },
    basePrice: { type: Number, required: true, min: 0 },
    imageUrl: { type: String },
    isAvailable: { type: Boolean, default: true },
    variantIds: [{ type: Schema.Types.ObjectId, ref: 'Variant' }],
  },
  { timestamps: true },
);

ProductSchema.index({ tenantId: 1, categoryId: 1, isAvailable: 1 });
ProductSchema.index({ tenantId: 1, name: 1 });
export const ProductModel = model<IProduct>('Product', ProductSchema);
