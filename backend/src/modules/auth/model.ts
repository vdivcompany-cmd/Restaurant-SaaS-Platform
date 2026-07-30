import { Schema, model, type Document, type Types } from 'mongoose';
import type { UserRole } from '../../shared/types/express.js';

export interface IUser extends Document {
  tenantId: Types.ObjectId | string;
  email: string;
  phone?: string;
  passwordHash: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ['super_admin', 'owner', 'manager', 'cashier', 'kitchen'],
      default: 'cashier',
      required: true,
    },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

// Compound index for fast and unique lookups per tenant
userSchema.index({ tenantId: 1, email: 1 }, { unique: true });

export const UserModel = model<IUser>('User', userSchema);
