import { Schema, model, type Document } from 'mongoose';

export interface IMenuLayout extends Document {
  tenantId: Schema.Types.ObjectId;
  branchId?: Schema.Types.ObjectId;
  theme: {
    primaryColor: string;
    backgroundColor: string;
    fontFamily: string;
    showAllergens: boolean;
    showCaloricCount: boolean;
  };
  promotionBanner?: {
    title: string;
    subtitle?: string;
    active: boolean;
    bannerImageUrl?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const menuLayoutSchema = new Schema<IMenuLayout>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', index: true },
    theme: {
      primaryColor: { type: String, default: '#FF6B00' },
      backgroundColor: { type: String, default: '#121212' },
      fontFamily: { type: String, default: 'Cairo' },
      showAllergens: { type: Boolean, default: true },
      showCaloricCount: { type: Boolean, default: false },
    },
    promotionBanner: {
      title: { type: String, trim: true },
      subtitle: { type: String, trim: true },
      active: { type: Boolean, default: false },
      bannerImageUrl: { type: String },
    },
  },
  { timestamps: true }
);

menuLayoutSchema.index({ tenantId: 1, branchId: 1 }, { unique: true });

export const MenuLayoutModel = model<IMenuLayout>('MenuLayout', menuLayoutSchema);
