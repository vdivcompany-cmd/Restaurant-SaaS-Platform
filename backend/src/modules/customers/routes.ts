import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { tenantMiddleware } from '../../middleware/tenant.middleware.js';
import { rbacMiddleware } from '../../middleware/rbac.middleware.js';
import {
  createCustomerHandler,
  listCustomersHandler,
  getCustomerHandler,
  updateCustomerHandler,
  deleteCustomerHandler,
} from './controller.js';

const router = Router();
router.use(authMiddleware, tenantMiddleware);

router.route('/')
  .post(rbacMiddleware(['owner', 'manager', 'cashier']), createCustomerHandler)
  .get(listCustomersHandler);

router.route('/:id')
  .get(getCustomerHandler)
  .put(rbacMiddleware(['owner', 'manager', 'cashier']), updateCustomerHandler)
  .delete(rbacMiddleware(['owner', 'manager']), deleteCustomerHandler);

export default router;
