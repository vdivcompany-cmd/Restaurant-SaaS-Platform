import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { tenantMiddleware } from '../../middleware/tenant.middleware.js';
import { rbacMiddleware } from '../../middleware/rbac.middleware.js';
import { upsertRestaurantHandler, getRestaurantHandler } from './controller.js';

const router = Router();
router.use(authMiddleware, tenantMiddleware);

router.route('/profile')
  .get(getRestaurantHandler)
  .put(rbacMiddleware(['owner', 'manager']), upsertRestaurantHandler)
  .post(rbacMiddleware(['owner', 'manager']), upsertRestaurantHandler);

export default router;
