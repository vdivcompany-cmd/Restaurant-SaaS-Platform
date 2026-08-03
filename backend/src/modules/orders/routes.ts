import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { tenantMiddleware } from '../../middleware/tenant.middleware.js';
import { rbacMiddleware } from '../../middleware/rbac.middleware.js';
import {
  createOrderHandler,
  createQrOrderHandler,
  syncOfflineOrdersHandler,
  listOrdersHandler,
  getOrderHandler,
  updateOrderStatusHandler,
} from './controller.js';

const router = Router();

// Public customer self-service QR ordering — no staff auth, gated by table session validation
router.post('/qr', tenantMiddleware, createQrOrderHandler);

router.use(authMiddleware, tenantMiddleware);

router.post('/offline-sync', rbacMiddleware(['owner', 'manager', 'cashier']), syncOfflineOrdersHandler);

router.route('/')
  .post(createOrderHandler)
  .get(listOrdersHandler);

router.route('/:id')
  .get(getOrderHandler)
  .patch(rbacMiddleware(['owner', 'manager', 'cashier', 'kitchen']), updateOrderStatusHandler);

export default router;
