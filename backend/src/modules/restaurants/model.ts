import { Schema, model, type Document, type Types } from 'mongoose';

export interface IRestaurant extends Document {
  tenantId: Types.ObjectId;
  brandName: string;
  cuisineType: string;
  description?: string;
  logoUrl?: string;
  currency: string;
  contactEmail?: string;
  contactPhone?: string;
  createdAt: Date;
  updatedAt: Date;
}

const RestaurantSchema = new Schema<IRestaurant>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, unique: true, index: true },
    brandName: { type: String, required: true },
    cuisineType: { type: String, default: 'General' },
    description: { type: String },
    logoUrl: { type: String },
    currency: { type: String, default: 'EGP' },
    contactEmail: { type: String },
    contactPhone: { type: String },
  },
  { timestamps: true },
);

export const RestaurantModel = model<IRestaurant>('Restaurant', RestaurantSchema);
