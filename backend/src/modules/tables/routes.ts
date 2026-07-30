import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { tenantMiddleware } from '../../middleware/tenant.middleware.js';
import { rbacMiddleware } from '../../middleware/rbac.middleware.js';
import {
  createTableHandler,
  listTablesHandler,
  getTableHandler,
  resolveQrTableHandler,
  updateTableHandler,
  deleteTableHandler,
} from './controller.js';

const router = Router();

router.get('/qr/:token', resolveQrTableHandler);

router.use(authMiddleware, tenantMiddleware);

router.route('/')
  .post(rbacMiddleware(['owner', 'manager']), createTableHandler)
  .get(listTablesHandler);

router.route('/:id')
  .get(getTableHandler)
  .put(rbacMiddleware(['owner', 'manager', 'cashier']), updateTableHandler)
  .delete(rbacMiddleware(['owner', 'manager']), deleteTableHandler);

export default router;
