import { Schema, model, type Document, type Types } from 'mongoose';

export type UploadStatusValue = 'queued' | 'processing' | 'completed' | 'failed';
export type UploadSourceType = 'csv' | 'pdf' | 'docx' | 'image' | 'json';

export interface IMenuUploadStatus extends Document {
  tenantId: Types.ObjectId;
  sourceType: UploadSourceType;
  sourceFilename?: string;
  status: UploadStatusValue;
  errorMessage?: string;
  resultCategoriesCount?: number;
  resultProductsCount?: number;
  sourceDocumentPublicId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const uploadStatusSchema = new Schema<IMenuUploadStatus>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    sourceType: { type: String, enum: ['csv', 'pdf', 'docx', 'image', 'json'], required: true },
    sourceFilename: { type: String },
    status: {
      type: String,
      enum: ['queued', 'processing', 'completed', 'failed'],
      default: 'queued',
      index: true,
    },
    errorMessage: { type: String },
    resultCategoriesCount: { type: Number },
    resultProductsCount: { type: Number },
    sourceDocumentPublicId: { type: String },
  },
  { timestamps: true }
);

export const MenuUploadStatusModel = model<IMenuUploadStatus>('MenuUploadStatus', uploadStatusSchema);
