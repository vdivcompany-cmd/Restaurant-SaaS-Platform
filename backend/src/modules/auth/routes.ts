import { Router } from 'express';
import { AuthController } from './controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { tenantMiddleware } from '../../middleware/tenant.middleware.js';

import { rbacMiddleware, requireSuperAdmin } from '../../middleware/rbac.middleware.js';

const router = Router();

// Registration endpoints
router.post('/register/super-admin', AuthController.registerSuperAdmin);
router.post('/register/owner', authMiddleware, requireSuperAdmin, AuthController.registerOwner);
router.post('/register/staff', authMiddleware, tenantMiddleware, rbacMiddleware(['owner', 'manager']), AuthController.registerStaff);

// Public auth endpoints
router.post('/login', AuthController.login);
router.post('/refresh', AuthController.refresh);
router.post('/forgot-password', AuthController.forgotPassword);
router.post('/verify-otp', AuthController.verifyOtp);
router.post('/reset-password', AuthController.resetPassword);

// Protected auth endpoints
router.post('/logout', authMiddleware, AuthController.logout);
router.post('/change-password', authMiddleware, tenantMiddleware, AuthController.changePassword);

export default router;
