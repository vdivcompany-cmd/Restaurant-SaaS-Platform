import { Schema, model, type Document, type Types } from 'mongoose';

export interface ICategory extends Document {
  tenantId: Types.ObjectId;
  name: string;
  displayOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CategorySchema = new Schema<ICategory>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    name: { type: String, required: true },
    displayOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

CategorySchema.index({ tenantId: 1, name: 1 }, { unique: true });
CategorySchema.index({ tenantId: 1, displayOrder: 1 });

export const CategoryModel = model<ICategory>('Category', CategorySchema);
