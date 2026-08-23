import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { tenantMiddleware } from '../../middleware/tenant.middleware.js';
import { rbacMiddleware } from '../../middleware/rbac.middleware.js';
import {
  createOrderHandler,
  createQrOrderHandler,
  createCustomerOrderHandler,
  confirmCashierOrderHandler,
  completeKitchenOrderHandler,
  completeOrderHandler,
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

// Public single order tracking — guest customer access
router.get('/:id', tenantMiddleware, getOrderHandler);

router.use(authMiddleware, tenantMiddleware);

// Staff-protected tenant order listing
router.get('/', rbacMiddleware(['super_admin', 'owner', 'manager', 'cashier', 'kitchen']), listOrdersHandler);

router.post('/offline-sync', rbacMiddleware(['super_admin', 'owner', 'manager', 'cashier']), syncOfflineOrdersHandler);

router.post('/', createOrderHandler);

// Cashier confirmation: sends order to Kitchen KDS
router.post('/:id/confirm-cashier', rbacMiddleware(['super_admin', 'owner', 'manager', 'cashier']), confirmCashierOrderHandler);

// Kitchen completion: marks cooking as READY
router.post('/:id/complete-kitchen', rbacMiddleware(['super_admin', 'owner', 'manager', 'kitchen']), completeKitchenOrderHandler);

// Final completion: completes order and frees table
router.post('/:id/complete', rbacMiddleware(['super_admin', 'owner', 'manager', 'cashier', 'kitchen']), completeOrderHandler);

router.patch('/:id', rbacMiddleware(['super_admin', 'owner', 'manager', 'cashier', 'kitchen']), updateOrderStatusHandler);

export default router;


