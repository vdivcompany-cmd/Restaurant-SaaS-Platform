import { Schema, model, type Document, type Types } from 'mongoose';

export type SubscriptionPlan = 'free' | 'starter' | 'pro' | 'enterprise';
export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'expired';

export interface ISubscription extends Document {
  tenantId: Types.ObjectId | string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const subscriptionSchema = new Schema<ISubscription>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true, unique: true },
    plan: {
      type: String,
      enum: ['free', 'starter', 'pro', 'enterprise'],
      default: 'free',
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'trialing', 'past_due', 'canceled', 'expired'],
      default: 'trialing',
      required: true,
    },
    expiresAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

export const SubscriptionModel = model<ISubscription>('Subscription', subscriptionSchema);
