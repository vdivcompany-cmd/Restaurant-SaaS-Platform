import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { tenantMiddleware } from '../../middleware/tenant.middleware.js';
import { rbacMiddleware } from '../../middleware/rbac.middleware.js';
import { dispatchNotificationHandler, listNotificationsHandler } from './controller.js';

const router = Router();

// GET /api/v1/notifications — list notification logs (staff only)
router.get(
  '/',
  authMiddleware,
  tenantMiddleware,
  rbacMiddleware(['owner', 'manager']),
  listNotificationsHandler
);

// POST /api/v1/notifications/dispatch — dispatch a notification (staff only)
router.post(
  '/dispatch',
  authMiddleware,
  tenantMiddleware,
  rbacMiddleware(['owner', 'manager']),
  dispatchNotificationHandler
);

export default router;
