import { Router } from 'express';
import { authMiddleware, optionalAuthMiddleware } from '../../middleware/auth.middleware.js';
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

// Public / Customer endpoint (supports both authenticated staff and public guest with tenant context)
router.get('/validate', optionalAuthMiddleware, tenantMiddleware, validateCouponHandler);
router.post('/validate', optionalAuthMiddleware, tenantMiddleware, validateCouponHandler);

// Protected staff & admin routes
router.use(authMiddleware, tenantMiddleware);

router.route('/')
  .post(rbacMiddleware(['super_admin', 'owner', 'manager']), createCouponHandler)
  .get(rbacMiddleware(['super_admin', 'owner', 'manager']), listCouponsHandler);

router.route('/:id')
  .put(rbacMiddleware(['super_admin', 'owner', 'manager']), updateCouponHandler)
  .delete(rbacMiddleware(['super_admin', 'owner', 'manager']), deleteCouponHandler);

export default router;

