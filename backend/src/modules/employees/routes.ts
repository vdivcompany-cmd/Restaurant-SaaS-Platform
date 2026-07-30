import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { tenantMiddleware } from '../../middleware/tenant.middleware.js';
import { rbacMiddleware } from '../../middleware/rbac.middleware.js';
import {
  createEmployeeHandler,
  listEmployeesHandler,
  getEmployeeHandler,
  updateEmployeeHandler,
  deleteEmployeeHandler,
} from './controller.js';

const router = Router();
router.use(authMiddleware, tenantMiddleware);

router.route('/')
  .post(rbacMiddleware(['owner', 'manager']), createEmployeeHandler)
  .get(rbacMiddleware(['owner', 'manager']), listEmployeesHandler);

router.route('/:id')
  .get(rbacMiddleware(['owner', 'manager']), getEmployeeHandler)
  .put(rbacMiddleware(['owner', 'manager']), updateEmployeeHandler)
  .delete(rbacMiddleware(['owner', 'manager']), deleteEmployeeHandler);

export default router;
