import { Schema, model, type Document, type Types } from 'mongoose';

export interface IVariantOption {
  name: string;
  priceDelta: number;
  isDefault?: boolean;
}

export interface IVariant extends Document {
  tenantId: Types.ObjectId;
  name: string; // e.g., "Size" or "Toppings"
  minSelect: number; // 0 for optional, 1 for required choice
  maxSelect: number; // 1 for radio buttons, >1 for checkboxes
  options: IVariantOption[];
  createdAt: Date;
  updatedAt: Date;
}

const VariantSchema = new Schema<IVariant>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    name: { type: String, required: true },
    minSelect: { type: Number, default: 0 },
    maxSelect: { type: Number, default: 1 },
    options: [
      {
        name: { type: String, required: true },
        priceDelta: { type: Number, required: true, default: 0 },
        isDefault: { type: Boolean, default: false },
      },
    ],
  },
  { timestamps: true },
);

VariantSchema.index({ tenantId: 1, name: 1 });
export const VariantModel = model<IVariant>('Variant', VariantSchema);
