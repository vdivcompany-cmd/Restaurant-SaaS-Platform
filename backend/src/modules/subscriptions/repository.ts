import { SubscriptionModel, type ISubscription } from './model.js';
import { tenantQuery } from '../../utils/tenantQuery.js';

export class SubscriptionRepository {
  public static async findByTenant(tenantId: string): Promise<ISubscription | null> {
    return tenantQuery.findOne(SubscriptionModel, tenantId, {});
  }

  public static async create(tenantId: string, data: Partial<ISubscription>): Promise<ISubscription> {
    return tenantQuery.create(SubscriptionModel, tenantId, data);
  }

  public static async save(subscription: ISubscription): Promise<ISubscription> {
    return subscription.save();
  }

  public static async updatePlan(
    tenantId: string,
    plan: ISubscription['plan'],
    status: ISubscription['status'],
    expiresAt?: Date
  ): Promise<void> {
    await tenantQuery.updateOne(SubscriptionModel, tenantId, {}, {
      $set: { plan, status, ...(expiresAt ? { expiresAt } : {}) },
    });
  }
}
