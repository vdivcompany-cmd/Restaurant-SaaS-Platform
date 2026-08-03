import { Schema, model, type Document, type Types } from 'mongoose';

export interface IProductSubDoc {
  _id: Types.ObjectId;
  name: string;
  description?: string;
  basePrice: number;
  categoryId?: Types.ObjectId;
  categoryName?: string;
  imageUrl?: string;
  isAvailable: boolean;
  variantIds: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IMenu extends Document {
  tenantId: Types.ObjectId;
  branchId?: Types.ObjectId;
  name: string;
  isActive: boolean;
  products: Types.DocumentArray<IProductSubDoc>;
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

export type IMenuLayout = IMenu;

const productSubSchema = new Schema<IProductSubDoc>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    basePrice: { type: Number, required: true, min: 0 },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category' },
    categoryName: { type: String, trim: true },
    imageUrl: { type: String },
    isAvailable: { type: Boolean, default: true },
    variantIds: [{ type: Schema.Types.ObjectId, ref: 'Variant' }],
  },
  { timestamps: true }
);

const menuSchema = new Schema<IMenu>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', index: true },
    name: { type: String, default: 'Main Menu', required: true },
    isActive: { type: Boolean, default: true },
    products: [productSubSchema],
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

menuSchema.index({ tenantId: 1, branchId: 1 }, { unique: true });
menuSchema.index({ tenantId: 1, 'products.name': 1 });

export const MenuModel = model<IMenu>('Menu', menuSchema);
export const MenuLayoutModel = MenuModel;

