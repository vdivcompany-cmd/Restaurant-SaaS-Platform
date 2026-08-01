import { Router } from 'express';
import { SubscriptionController } from './controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { tenantMiddleware } from '../../middleware/tenant.middleware.js';
import { rbacMiddleware, requireSuperAdmin } from '../../middleware/rbac.middleware.js';

const router = Router();

// GET /api/v1/subscriptions — get active subscription for the current tenant
router.get(
  '/',
  authMiddleware,
  tenantMiddleware,
  rbacMiddleware(['owner', 'manager']),
  SubscriptionController.getSubscription
);

// PATCH /api/v1/subscriptions — update plan (super_admin only, targeting tenant via body)
router.patch(
  '/',
  authMiddleware,
  tenantMiddleware,
  requireSuperAdmin,
  SubscriptionController.updateSubscription
);

export default router;
