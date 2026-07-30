import { Router } from 'express';
import { BillingController } from './controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { tenantMiddleware } from '../../middleware/tenant.middleware.js';
import { rbacMiddleware } from '../../middleware/rbac.middleware.js';

const router = Router();

// GET /api/v1/billing — list all billing records for the tenant
router.get(
  '/',
  authMiddleware,
  tenantMiddleware,
  rbacMiddleware(['owner', 'manager']),
  BillingController.getRecords
);

// GET /api/v1/billing/:id — get a specific billing record
router.get(
  '/:id',
  authMiddleware,
  tenantMiddleware,
  rbacMiddleware(['owner', 'manager']),
  BillingController.getRecord
);

// POST /api/v1/billing — create a billing record
router.post(
  '/',
  authMiddleware,
  tenantMiddleware,
  rbacMiddleware(['owner']),
  BillingController.createRecord
);

export default router;
