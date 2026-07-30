import { Router } from 'express';
import { AuthController } from './controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { tenantMiddleware } from '../../middleware/tenant.middleware.js';

const router = Router();

// Public auth endpoints
router.post('/register', AuthController.register);
router.post('/login', AuthController.login);
router.post('/refresh', AuthController.refresh);

// Protected auth endpoints
router.post('/logout', authMiddleware, AuthController.logout);
router.post('/change-password', authMiddleware, tenantMiddleware, AuthController.changePassword);

export default router;
