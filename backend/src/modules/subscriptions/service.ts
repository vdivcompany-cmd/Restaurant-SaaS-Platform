import { SubscriptionRepository } from './repository.js';
import type { ISubscription } from './model.js';
import { AppError } from '../../middleware/errorHandler.middleware.js';
import type { UpdateSubscriptionInput } from './validation.js';

export class SubscriptionService {
  /**
   * Get the active subscription for a tenant. Creates a free-tier record
   * on first call (idempotent bootstrapping).
   */
  public static async getSubscription(tenantId: string): Promise<ISubscription> {
    let subscription = await SubscriptionRepository.findByTenant(tenantId);
    if (!subscription) {
      subscription = await SubscriptionRepository.create(tenantId, {
        plan: 'free',
        status: 'trialing',
      });
    }
    return subscription;
  }

  /**
   * Update the subscription plan for a tenant (used by billing/Paymob webhooks).
   */
  public static async updateSubscription(
    tenantId: string,
    data: UpdateSubscriptionInput
  ): Promise<ISubscription> {
    const subscription = await SubscriptionRepository.findByTenant(tenantId);
    if (!subscription) {
      throw new AppError('No subscription record found for tenant', 404);
    }

    subscription.plan = data.plan;
    if (data.status) subscription.status = data.status;
    if (data.expiresAt) subscription.expiresAt = new Date(data.expiresAt);

    return SubscriptionRepository.save(subscription);
  }
}
