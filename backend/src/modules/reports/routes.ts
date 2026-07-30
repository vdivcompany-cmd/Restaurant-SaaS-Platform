import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { tenantMiddleware } from '../../middleware/tenant.middleware.js';
import { rbacMiddleware } from '../../middleware/rbac.middleware.js';
import { getSalesReportHandler } from './controller.js';

const router = Router();

router.use(authMiddleware, tenantMiddleware, rbacMiddleware(['owner', 'manager']));
router.get('/sales', getSalesReportHandler);

export default router;
