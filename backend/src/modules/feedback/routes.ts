import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { tenantMiddleware } from '../../middleware/tenant.middleware.js';
import { rbacMiddleware } from '../../middleware/rbac.middleware.js';
import { createFeedbackHandler, listFeedbackHandler } from './controller.js';

const router = Router();
router.post('/', tenantMiddleware, createFeedbackHandler);
router.get('/', authMiddleware, tenantMiddleware, rbacMiddleware(['owner', 'manager']), listFeedbackHandler);

export default router;
