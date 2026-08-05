import { Router } from 'express';
import multer from 'multer';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { tenantMiddleware } from '../../middleware/tenant.middleware.js';
import { rbacMiddleware } from '../../middleware/rbac.middleware.js';
import {
  uploadMenuHandler,
  listDraftsHandler,
  getDraftHandler,
  editDraftHandler,
  approveDraftHandler,
} from './controller.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});

router.use(authMiddleware, tenantMiddleware);

router.post('/upload', rbacMiddleware(['owner', 'manager']), upload.single('file'), uploadMenuHandler);
router.get('/drafts', rbacMiddleware(['owner', 'manager']), listDraftsHandler);
router.get('/drafts/:id', rbacMiddleware(['owner', 'manager']), getDraftHandler);
router.put('/drafts/:id', rbacMiddleware(['owner', 'manager']), editDraftHandler);
router.post('/drafts/:id/approve', rbacMiddleware(['owner', 'manager']), approveDraftHandler);

export default router;
