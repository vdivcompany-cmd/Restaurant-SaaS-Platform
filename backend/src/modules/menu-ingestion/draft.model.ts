import { Schema, model, type Document, type Types } from 'mongoose';

export type MenuDraftStatus = 'parsing' | 'ready' | 'failed' | 'approved';
export type MenuDraftMode = 'replace' | 'merge';

export interface IExtractedProduct {
  name: string;
  description?: string;
  basePrice: number;
  imageUrl?: string;
}

export interface IExtractedCategory {
  name: string;
  displayOrder?: number;
  products: IExtractedProduct[];
}

export interface IMenuDraft extends Document {
  tenantId: Types.ObjectId;
  sourceType: 'csv' | 'pdf' | 'docx' | 'image' | 'manual';
  sourceFilename?: string;
  status: MenuDraftStatus;
  mode?: MenuDraftMode;
  categories: IExtractedCategory[];
  rawText?: string;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

const optionSchema = new Schema(
  {
    name: { type: String, required: true },
    additionalPrice: { type: Number, default: 0 },
  },
  { _id: false }
);

const productSchema = new Schema<IExtractedProduct>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String },
    basePrice: { type: Number, required: true, min: 0 },
    imageUrl: { type: String },
  },
  { _id: false }
);

const categorySchema = new Schema<IExtractedCategory>(
  {
    name: { type: String, required: true, trim: true },
    displayOrder: { type: Number, default: 0 },
    products: [productSchema],
  },
  { _id: false }
);

const draftSchema = new Schema<IMenuDraft>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    sourceType: { type: String, enum: ['csv', 'pdf', 'docx', 'image', 'manual'], required: true },
    sourceFilename: { type: String },
    status: { type: String, enum: ['parsing', 'ready', 'failed', 'approved'], default: 'parsing', index: true },
    mode: { type: String, enum: ['replace', 'merge'] },
    categories: [categorySchema],
    rawText: { type: String },
    errorMessage: { type: String },
  },
  { timestamps: true }
);

// silence unused warning for reused schema helper
void optionSchema;

export const MenuDraftModel = model<IMenuDraft>('MenuDraft', draftSchema);
