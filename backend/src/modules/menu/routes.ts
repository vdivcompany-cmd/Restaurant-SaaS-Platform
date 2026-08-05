import { Router } from 'express';
import { tenantMiddleware } from '../../middleware/tenant.middleware.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { rbacMiddleware } from '../../middleware/rbac.middleware.js';
import {
  getMenuCatalogHandler,
  bulkImportMenuHandler,
  getRagCatalogHandler,
  addProductHandler,
  updateProductHandler,
  deleteProductHandler,
  getProductHandler,
  listProductsHandler,
} from './controller.js';

const router = Router();

// Public RAG catalog extraction route for n8n Cloud & Vector Embeddings
router.get('/rag-catalog/:tenantId', getRagCatalogHandler);
router.get('/rag-catalog', tenantMiddleware, getRagCatalogHandler);

// Public route for scanning table QR code
router.get('/', tenantMiddleware, getMenuCatalogHandler);
router.get('/catalog', tenantMiddleware, getMenuCatalogHandler);

// Product sub-document array management routes under Menu
router.route('/products')
  .post(authMiddleware, tenantMiddleware, rbacMiddleware(['owner', 'manager']), addProductHandler)
  .get(tenantMiddleware, listProductsHandler);

router.route('/products/:id')
  .get(tenantMiddleware, getProductHandler)
  .put(authMiddleware, tenantMiddleware, rbacMiddleware(['owner', 'manager']), updateProductHandler)
  .delete(authMiddleware, tenantMiddleware, rbacMiddleware(['owner', 'manager']), deleteProductHandler);

// Secured bulk import API Gateway for AI onboarding / Super Admin / Managers
router.post(
  '/bulk-import',
  authMiddleware,
  tenantMiddleware,
  rbacMiddleware(['super_admin', 'owner', 'manager']),
  bulkImportMenuHandler
);

// NOTE: PDF/image menu uploads live at POST /api/v1/menu-ingestion/upload
// (draft-review-approve flow with real parsers + LLM extraction).

export default router;


