import type { Request, Response, NextFunction } from 'express';
import type { SubscriptionPlan } from '../modules/subscriptions/model.js';
import { SubscriptionRepository } from '../modules/subscriptions/repository.js';

/**
 * Subscription Guard Middleware
 * Blocks requests from tenants whose subscription does not meet the required plan tier.
 * Must be used AFTER authMiddleware and tenantMiddleware so that req.tenantId is available.
 *
 * Plan tier order: free < starter < pro < enterprise
 */
const PLAN_TIER: Record<SubscriptionPlan, number> = {
  free: 0,
  starter: 1,
  pro: 2,
  enterprise: 3,
};

export function subscriptionGuard(requiredPlan: SubscriptionPlan) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.tenantId) {
        res.status(400).json({ success: false, message: 'Tenant context required for subscription check' });
        return;
      }

      const subscription = await SubscriptionRepository.findByTenant(req.tenantId);

      if (!subscription || subscription.status === 'canceled' || subscription.status === 'expired') {
        res.status(402).json({
          success: false,
          message: 'No active subscription. Please subscribe to access this feature.',
        });
        return;
      }

      const tenantTier = PLAN_TIER[subscription.plan];
      const requiredTier = PLAN_TIER[requiredPlan];

      if (tenantTier < requiredTier) {
        res.status(402).json({
          success: false,
          message: `This feature requires the '${requiredPlan}' plan or higher. Current plan: '${subscription.plan}'.`,
        });
        return;
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
