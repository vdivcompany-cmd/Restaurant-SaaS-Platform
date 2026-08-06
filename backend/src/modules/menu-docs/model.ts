import { Schema, model, type Document, type Types } from 'mongoose';

export type MenuDocFileType = 'image' | 'pdf';

export interface IMenuDocument extends Document {
  tenantId: Types.ObjectId;
  title: string;
  fileUrl: string;
  publicId: string;
  fileType: MenuDocFileType;
  mimeType: string;
  fileSize: number;
  isActive: boolean;
  uploadedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const MenuDocumentSchema = new Schema<IMenuDocument>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    title: { type: String, required: true, trim: true },
    fileUrl: { type: String, required: true },
    publicId: { type: String, required: true },
    fileType: {
      type: String,
      enum: ['image', 'pdf'],
      required: true,
    },
    mimeType: { type: String, required: true },
    fileSize: { type: Number, required: true, min: 0 },
    isActive: { type: Boolean, default: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'Employee' },
  },
  { timestamps: true },
);

MenuDocumentSchema.index({ tenantId: 1, isActive: 1 });

export const MenuDocumentModel = model<IMenuDocument>('MenuDocument', MenuDocumentSchema);
