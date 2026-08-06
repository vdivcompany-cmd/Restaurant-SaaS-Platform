import { Router } from 'express';
import multer from 'multer';
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
import { uploadMenuHandler, getUploadStatusHandler } from './upload.controller.js';

const router = Router();

// 20 MB limit; accepts CSV, PDF, DOCX, and images
const uploadMulter = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'text/csv',
      'application/csv',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png',
      'image/webp',
    ];
    if (allowed.includes(file.mimetype) || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  },
});

// Public RAG catalog extraction route for n8n Cloud & Vector Embeddings
router.get('/rag-catalog/:tenantId', getRagCatalogHandler);
router.get('/rag-catalog', tenantMiddleware, getRagCatalogHandler);

// Public route for scanning table QR code
router.get('/', tenantMiddleware, getMenuCatalogHandler);
router.get('/catalog', tenantMiddleware, getMenuCatalogHandler);

// Unified upload: JSON body (sync) or file (async queued)
router.post(
  '/upload',
  authMiddleware,
  tenantMiddleware,
  rbacMiddleware(['super_admin', 'owner', 'manager']),
  uploadMulter.single('file'),
  uploadMenuHandler
);

// Upload status poll endpoint
router.get(
  '/uploads/:id',
  authMiddleware,
  tenantMiddleware,
  rbacMiddleware(['super_admin', 'owner', 'manager']),
  getUploadStatusHandler
);

// Product sub-document array management — the only single-product CRUD surface
router.route('/products')
  .post(authMiddleware, tenantMiddleware, rbacMiddleware(['owner', 'manager']), addProductHandler)
  .get(tenantMiddleware, listProductsHandler);

router.route('/products/:id')
  .get(tenantMiddleware, getProductHandler)
  .put(authMiddleware, tenantMiddleware, rbacMiddleware(['owner', 'manager']), updateProductHandler)
  .delete(authMiddleware, tenantMiddleware, rbacMiddleware(['owner', 'manager']), deleteProductHandler);

// Secured bulk import for AI onboarding / Super Admin / Managers
router.post(
  '/bulk-import',
  authMiddleware,
  tenantMiddleware,
  rbacMiddleware(['super_admin', 'owner', 'manager']),
  bulkImportMenuHandler
);

export default router;


