import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { tenantMiddleware } from '../../middleware/tenant.middleware.js';
import { rbacMiddleware } from '../../middleware/rbac.middleware.js';
import { vectorSearchHandler } from './controller.js';

const router = Router();

router.use(authMiddleware, tenantMiddleware);
router.get(
  '/search',
  rbacMiddleware(['owner', 'manager', 'cashier', 'super_admin']),
  vectorSearchHandler
);

export default router;
