import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { tenantMiddleware } from '../../middleware/tenant.middleware.js';
import { rbacMiddleware } from '../../middleware/rbac.middleware.js';
import {
  createCouponHandler,
  listCouponsHandler,
  validateCouponHandler,
  updateCouponHandler,
  deleteCouponHandler,
} from './controller.js';

const router = Router();
router.use(authMiddleware, tenantMiddleware);

router.get('/validate', validateCouponHandler);

router.route('/')
  .post(rbacMiddleware(['owner', 'manager']), createCouponHandler)
  .get(listCouponsHandler);

router.route('/:id')
  .put(rbacMiddleware(['owner', 'manager']), updateCouponHandler)
  .delete(rbacMiddleware(['owner', 'manager']), deleteCouponHandler);

export default router;
