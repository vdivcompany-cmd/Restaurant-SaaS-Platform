import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { tenantMiddleware } from '../../middleware/tenant.middleware.js';
import { rbacMiddleware } from '../../middleware/rbac.middleware.js';
import {
  createCategoryHandler,
  listCategoriesHandler,
  getCategoryHandler,
  updateCategoryHandler,
  deleteCategoryHandler,
} from './controller.js';

const router = Router();
router.use(authMiddleware, tenantMiddleware);

router.route('/')
  .post(rbacMiddleware(['owner', 'manager']), createCategoryHandler)
  .get(listCategoriesHandler);

router.route('/:id')
  .get(getCategoryHandler)
  .put(rbacMiddleware(['owner', 'manager']), updateCategoryHandler)
  .delete(rbacMiddleware(['owner', 'manager']), deleteCategoryHandler);

export default router;
