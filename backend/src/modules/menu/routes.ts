import { Router } from 'express';
import { tenantMiddleware } from '../../middleware/tenant.middleware.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { rbacMiddleware } from '../../middleware/rbac.middleware.js';
import { getMenuCatalogHandler, bulkImportMenuHandler } from './controller.js';

const router = Router();

// Public route for scanning table QR code
router.get('/', tenantMiddleware, getMenuCatalogHandler);
router.get('/catalog', tenantMiddleware, getMenuCatalogHandler);

// Secured bulk import API Gateway for AI onboarding / Super Admin / Managers
router.post(
  '/bulk-import',
  authMiddleware,
  tenantMiddleware,
  rbacMiddleware(['super_admin', 'owner', 'manager']),
  bulkImportMenuHandler
);

export default router;
