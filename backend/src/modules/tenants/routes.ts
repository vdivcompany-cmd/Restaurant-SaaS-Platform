import { Router } from 'express';
import { TenantController } from './controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { tenantMiddleware } from '../../middleware/tenant.middleware.js';
import { rbacMiddleware, requireSuperAdmin } from '../../middleware/rbac.middleware.js';

const router = Router();

// Create tenant — strictly restricted to Platform Super Admins
router.post('/', authMiddleware, requireSuperAdmin, TenantController.createTenant);

// Public AI Gateway Endpoint for n8n Cloud / AI Bot
router.get('/:tenantId/ai-status', TenantController.getAiStatus);

// Profile management
router.route('/profile')
  .get(authMiddleware, tenantMiddleware, TenantController.getProfile)
  .put(authMiddleware, tenantMiddleware, rbacMiddleware(['owner', 'manager']), TenantController.upsertProfile)
  .post(authMiddleware, tenantMiddleware, rbacMiddleware(['owner', 'manager']), TenantController.upsertProfile);

// Get tenant details
router.get(
  '/me',
  authMiddleware,
  tenantMiddleware,
  rbacMiddleware(['owner', 'manager']),
  TenantController.getTenant
);

router.get(
  '/:id',
  authMiddleware,
  tenantMiddleware,
  rbacMiddleware(['owner', 'manager']),
  TenantController.getTenant
);

// Update tenant settings
router.patch(
  '/settings',
  authMiddleware,
  tenantMiddleware,
  rbacMiddleware(['owner']),
  TenantController.updateSettings
);

router.patch(
  '/:id/settings',
  authMiddleware,
  tenantMiddleware,
  rbacMiddleware(['owner']),
  TenantController.updateSettings
);

export default router;
