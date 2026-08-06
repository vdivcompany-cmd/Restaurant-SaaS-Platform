import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { tenantMiddleware } from '../../middleware/tenant.middleware.js';
import { rbacMiddleware } from '../../middleware/rbac.middleware.js';
import {
  createOrderHandler,
  createQrOrderHandler,
  createCustomerOrderHandler,
  syncOfflineOrdersHandler,
  listOrdersHandler,
  getOrderHandler,
  updateOrderStatusHandler,
} from './controller.js';

const router = Router();

// Public customer self-service QR ordering — no staff auth, gated by table session validation
router.post('/qr', tenantMiddleware, createQrOrderHandler);

// Public self-service ordering for takeaway / delivery — identified by name + phone, no staff auth
router.post('/customer', tenantMiddleware, createCustomerOrderHandler);

// Public order history — no auth required
router.get('/', tenantMiddleware, listOrdersHandler);
router.get('/:id', tenantMiddleware, getOrderHandler);

router.use(authMiddleware, tenantMiddleware);

router.post('/offline-sync', rbacMiddleware(['owner', 'manager', 'cashier']), syncOfflineOrdersHandler);

router.post('/', createOrderHandler);

router.patch('/:id', rbacMiddleware(['owner', 'manager', 'cashier', 'kitchen']), updateOrderStatusHandler);

export default router;

