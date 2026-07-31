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
  isOpen: boolean;
  isChatbotActive: boolean;
  chatbotSettings?: {
    offlineMessage?: string;
    aiModelPreference?: string;
  };
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
    isOpen: { type: Boolean, default: true },
    isChatbotActive: { type: Boolean, default: true },
    chatbotSettings: {
      offlineMessage: { type: String, default: 'We are currently closed for orders. Please check back during operating hours!' },
      aiModelPreference: { type: String, default: 'gpt-4o' },
    },
  },
  { timestamps: true },
);

export const RestaurantModel = model<IRestaurant>('Restaurant', RestaurantSchema);
