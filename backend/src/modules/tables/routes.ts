import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { tenantMiddleware } from '../../middleware/tenant.middleware.js';
import { rbacMiddleware } from '../../middleware/rbac.middleware.js';
import {
  createTableHandler,
  listTablesHandler,
  getTableHandler,
  resolveQrTableHandler,
  scanQrTableHandler,
  getQrImageHandler,
  updateTableHandler,
  deleteTableHandler,
  getTableOrderHistoryHandler,
} from './controller.js';

const router = Router();

router.get('/qr/:token', resolveQrTableHandler);
router.get('/scan/:token', scanQrTableHandler);

router.use(authMiddleware, tenantMiddleware);

router.get('/:id/qr-image', rbacMiddleware(['owner', 'manager', 'cashier']), getQrImageHandler);

router.route('/')
  .post(rbacMiddleware(['owner', 'manager']), createTableHandler)
  .get(listTablesHandler);

router.route('/:id')
  .get(getTableHandler)
  .put(rbacMiddleware(['owner', 'manager', 'cashier']), updateTableHandler)
  .delete(rbacMiddleware(['owner', 'manager']), deleteTableHandler);

router.get('/:id/history', rbacMiddleware(['owner', 'manager', 'cashier']), getTableOrderHistoryHandler);

export default router;
