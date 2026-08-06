import { Router } from 'express';
import multer from 'multer';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { tenantMiddleware } from '../../middleware/tenant.middleware.js';
import { rbacMiddleware } from '../../middleware/rbac.middleware.js';
import {
  uploadMenuDocHandler,
  listMenuDocsHandler,
  getMenuDocHandler,
  updateMenuDocHandler,
  deleteMenuDocHandler,
} from './controller.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file format. Only JPEG, PNG, WEBP, and PDF files are allowed.'));
    }
  },
});

// ─── Public routes (tenant-scoped, no staff auth) ────────────────────────────
// Customers can list and view active menu documents
router.get('/', tenantMiddleware, listMenuDocsHandler);
router.get('/:id', tenantMiddleware, getMenuDocHandler);

// ─── Authenticated routes (owner/manager only) ──────────────────────────────
router.post(
  '/upload',
  authMiddleware,
  tenantMiddleware,
  rbacMiddleware(['owner', 'manager']),
  upload.single('file'),
  uploadMenuDocHandler
);

router.patch(
  '/:id',
  authMiddleware,
  tenantMiddleware,
  rbacMiddleware(['owner', 'manager']),
  updateMenuDocHandler
);

router.delete(
  '/:id',
  authMiddleware,
  tenantMiddleware,
  rbacMiddleware(['owner', 'manager']),
  deleteMenuDocHandler
);

export default router;
