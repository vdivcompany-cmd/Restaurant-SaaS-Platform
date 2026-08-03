import { Router } from 'express';
import { tenantMiddleware } from '../../middleware/tenant.middleware.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { rbacMiddleware } from '../../middleware/rbac.middleware.js';
import { uploadMiddleware } from '../../integrations/cloudinary/index.js';
import {
  getMenuCatalogHandler,
  bulkImportMenuHandler,
  getRagCatalogHandler,
  uploadMenuFileHandler,
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

// Secured AI Menu file upload API Gateway (PDF/Image) for Super Admin / Owners / Managers
router.post(
  '/upload-file',
  authMiddleware,
  tenantMiddleware,
  uploadMiddleware.single('file'),
  rbacMiddleware(['super_admin', 'owner', 'manager']),
  uploadMenuFileHandler
);

export default router;


