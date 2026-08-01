import { Router } from 'express';
import { ReservationController } from './controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { tenantMiddleware } from '../../middleware/tenant.middleware.js';
import { rbacMiddleware } from '../../middleware/rbac.middleware.js';

const router = Router();

// POST /api/v1/reservations — public endpoint for chatbot/webhook
router.post('/', tenantMiddleware, ReservationController.createReservation);

// GET /api/v1/reservations — list reservations (staff only)
router.get(
  '/',
  authMiddleware,
  tenantMiddleware,
  rbacMiddleware(['owner', 'manager', 'cashier']),
  ReservationController.listReservations
);

// PATCH /api/v1/reservations/:id — update reservation status (staff only)
router.patch(
  '/:id',
  authMiddleware,
  tenantMiddleware,
  rbacMiddleware(['owner', 'manager', 'cashier']),
  ReservationController.updateReservation
);

// DELETE /api/v1/reservations/:id — cancel reservation (staff only)
router.delete(
  '/:id',
  authMiddleware,
  tenantMiddleware,
  rbacMiddleware(['owner', 'manager', 'cashier']),
  ReservationController.deleteReservation
);

export default router;
