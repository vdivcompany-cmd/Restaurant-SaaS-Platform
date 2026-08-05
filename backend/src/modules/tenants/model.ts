import { Schema, model, type Document } from 'mongoose';

export type TenantStatus = 'active' | 'suspended' | 'trial';
export type TenantLanguage = 'ar' | 'en';

export interface ITenantContact {
  phone: string;
  email: string;
}

export interface ITenantSettings {
  currency: string;
  timezone: string;
  language: TenantLanguage;
}

export interface IChatbotSettings {
  offlineMessage?: string | undefined;
  aiModelPreference?: string | undefined;
}

export interface ITenant extends Document {
  name: string;
  slug: string;
  status: TenantStatus;
  subscriptionPlan: string;
  subscriptionExpiresAt?: Date;
  contact: ITenantContact;
  settings: ITenantSettings;
  // ─── Restaurant Profile Fields ─────────────────────────────────────────────
  brandName?: string;
  cuisineType?: string;
  description?: string;
  logoUrl?: string;
  qrRedirectUrl?: string;
  isOpen: boolean;
  isChatbotActive: boolean;
  chatbotSettings?: IChatbotSettings;
  createdAt: Date;
  updatedAt: Date;
}

const tenantSchema = new Schema<ITenant>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    status: { type: String, enum: ['active', 'suspended', 'trial'], default: 'trial' },
    subscriptionPlan: { type: String, default: 'free' },
    subscriptionExpiresAt: { type: Date },
    contact: {
      phone: { type: String, required: true },
      email: { type: String, required: true },
    },
    settings: {
      currency: { type: String, default: 'EGP' },
      timezone: { type: String, default: 'Africa/Cairo' },
      language: { type: String, enum: ['ar', 'en'], default: 'ar' },
    },
    // ─── Restaurant Profile Fields ─────────────────────────────────────────────
    brandName: { type: String },
    cuisineType: { type: String, default: 'General' },
    description: { type: String },
    logoUrl: { type: String },
    qrRedirectUrl: { type: String, default: 'https://t.me/resturanchatbot' },
    isOpen: { type: Boolean, default: true },
    isChatbotActive: { type: Boolean, default: true },
    chatbotSettings: {
      offlineMessage: { type: String, default: 'We are currently closed for orders. Please check back during operating hours!' },
      aiModelPreference: { type: String, default: 'gpt-4o' },
    },
  },
  {
    timestamps: true,
  }
);

export const TenantModel = model<ITenant>('Tenant', tenantSchema);
