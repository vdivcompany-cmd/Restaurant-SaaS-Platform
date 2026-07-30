import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { tenantMiddleware } from '../../middleware/tenant.middleware.js';
import { rbacMiddleware } from '../../middleware/rbac.middleware.js';
import {
  createBranchHandler,
  listBranchesHandler,
  getBranchHandler,
  updateBranchHandler,
  deleteBranchHandler,
} from './controller.js';

const router = Router();
router.use(authMiddleware, tenantMiddleware);

router.route('/')
  .post(rbacMiddleware(['owner', 'manager']), createBranchHandler)
  .get(listBranchesHandler);

router.route('/:id')
  .get(getBranchHandler)
  .put(rbacMiddleware(['owner', 'manager']), updateBranchHandler)
  .delete(rbacMiddleware(['owner']), deleteBranchHandler);

export default router;
