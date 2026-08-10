import { Router } from 'express';
import { authMiddleware, optionalAuthMiddleware } from '../../middleware/auth.middleware.js';
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
<<<<<<< HEAD
router.get('/:id/history', optionalAuthMiddleware, tenantMiddleware, getTableOrderHistoryHandler);
=======
router.get('/scan/:token', scanQrTableHandler);
>>>>>>> 611dad0087a7a9ac172414630c8bdbee57b4eb1b

router.use(authMiddleware, tenantMiddleware);

router.get('/:id/qr-image', rbacMiddleware(['owner', 'manager', 'cashier']), getQrImageHandler);

router.route('/')
  .post(rbacMiddleware(['owner', 'manager']), createTableHandler)
  .get(listTablesHandler);

router.route('/:id')
  .get(getTableHandler)
  .put(rbacMiddleware(['owner', 'manager', 'cashier']), updateTableHandler)
  .delete(rbacMiddleware(['owner', 'manager']), deleteTableHandler);

export default router;

