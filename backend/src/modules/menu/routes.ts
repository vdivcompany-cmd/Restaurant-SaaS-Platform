import { Router } from 'express';
import { tenantMiddleware } from '../../middleware/tenant.middleware.js';
import { getMenuCatalogHandler } from './controller.js';

const router = Router();

// Notice: No authMiddleware here! Customers scanning QR codes on their dining table
// must be able to view the menu without registering a cashier/manager login account.
router.use(tenantMiddleware);
router.get('/', getMenuCatalogHandler);
router.get('/catalog', getMenuCatalogHandler);

export default router;
