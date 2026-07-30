import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { tenantMiddleware } from '../../middleware/tenant.middleware.js';
import { rbacMiddleware } from '../../middleware/rbac.middleware.js';
import {
  createProductHandler,
  listProductsHandler,
  getProductHandler,
  updateProductHandler,
  deleteProductHandler,
} from './controller.js';

const router = Router();
router.use(authMiddleware, tenantMiddleware);

router.route('/')
  .post(rbacMiddleware(['owner', 'manager']), createProductHandler)
  .get(listProductsHandler);

router.route('/:id')
  .get(getProductHandler)
  .put(rbacMiddleware(['owner', 'manager']), updateProductHandler)
  .delete(rbacMiddleware(['owner', 'manager']), deleteProductHandler);

export default router;
