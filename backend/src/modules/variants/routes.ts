import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { tenantMiddleware } from '../../middleware/tenant.middleware.js';
import { rbacMiddleware } from '../../middleware/rbac.middleware.js';
import {
  createVariantHandler,
  listVariantsHandler,
  getVariantHandler,
  updateVariantHandler,
  deleteVariantHandler,
} from './controller.js';

const router = Router();
router.use(authMiddleware, tenantMiddleware);

router.route('/')
  .post(rbacMiddleware(['owner', 'manager']), createVariantHandler)
  .get(listVariantsHandler);

router.route('/:id')
  .get(getVariantHandler)
  .put(rbacMiddleware(['owner', 'manager']), updateVariantHandler)
  .delete(rbacMiddleware(['owner', 'manager']), deleteVariantHandler);

export default router;
