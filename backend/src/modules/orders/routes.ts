import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { tenantMiddleware } from '../../middleware/tenant.middleware.js';
import { rbacMiddleware } from '../../middleware/rbac.middleware.js';
import {
  createOrderHandler,
  syncOfflineOrdersHandler,
  listOrdersHandler,
  getOrderHandler,
  updateOrderStatusHandler,
} from './controller.js';

const router = Router();

router.use(authMiddleware, tenantMiddleware);

router.post('/offline-sync', rbacMiddleware(['owner', 'manager', 'cashier']), syncOfflineOrdersHandler);

router.route('/')
  .post(createOrderHandler)
  .get(listOrdersHandler);

router.route('/:id')
  .get(getOrderHandler)
  .patch(rbacMiddleware(['owner', 'manager', 'cashier', 'kitchen']), updateOrderStatusHandler);

export default router;
