import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { tenantMiddleware } from '../../middleware/tenant.middleware.js';
import { rbacMiddleware } from '../../middleware/rbac.middleware.js';
import { dispatchNotificationHandler } from './controller.js';

const router = Router();

router.use(authMiddleware, tenantMiddleware, rbacMiddleware(['owner', 'manager']));
router.post('/dispatch', dispatchNotificationHandler);

export default router;
