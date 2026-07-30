import { Router } from 'express';
import { SubscriptionController } from './controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { tenantMiddleware } from '../../middleware/tenant.middleware.js';
import { rbacMiddleware } from '../../middleware/rbac.middleware.js';

const router = Router();

// GET /api/v1/subscriptions — get active subscription for the current tenant
router.get(
  '/',
  authMiddleware,
  tenantMiddleware,
  rbacMiddleware(['owner', 'manager']),
  SubscriptionController.getSubscription
);

// PATCH /api/v1/subscriptions — update plan (internal / billing webhook use only, owner)
router.patch(
  '/',
  authMiddleware,
  tenantMiddleware,
  rbacMiddleware(['owner']),
  SubscriptionController.updateSubscription
);

export default router;
