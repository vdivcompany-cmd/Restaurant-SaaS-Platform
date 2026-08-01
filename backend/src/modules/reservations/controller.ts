import type { Request, Response, NextFunction } from 'express';
import { ReservationService } from './service.js';
import { CreateReservationSchema, UpdateReservationSchema } from './validation.js';

export class ReservationController {
  public static async createReservation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = CreateReservationSchema.parse(req.body);
      const reservation = await ReservationService.createReservation(validated.tenantId, validated);
      res.status(201).json({ success: true, data: reservation });
    } catch (err) {
      next(err);
    }
  }

  public static async listReservations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.tenantId) {
        res.status(400).json({ success: false, message: 'Tenant context required' });
        return;
      }
      const branchId = typeof req.query['branchId'] === 'string' ? req.query['branchId'] : undefined;
      const status = typeof req.query['status'] === 'string' ? req.query['status'] : undefined;
      const reservations = await ReservationService.listReservations(req.tenantId, branchId, status);
      res.json({ success: true, data: reservations });
    } catch (err) {
      next(err);
    }
  }

  public static async updateReservation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.tenantId) {
        res.status(400).json({ success: false, message: 'Tenant context required' });
        return;
      }
      const reservationId = typeof req.params['id'] === 'string' ? req.params['id'] : undefined;
      if (!reservationId) {
        res.status(400).json({ success: false, message: 'Reservation ID required' });
        return;
      }
      const validated = UpdateReservationSchema.parse(req.body);

      let reservation;
      if (validated.status === 'CONFIRMED') {
        reservation = await ReservationService.confirmReservation(req.tenantId, reservationId, validated);
      } else if (validated.status === 'SEATED') {
        reservation = await ReservationService.markSeated(req.tenantId, reservationId);
      } else if (validated.status === 'CANCELLED') {
        reservation = await ReservationService.cancelReservation(req.tenantId, reservationId);
      } else if (validated.status === 'NO_SHOW') {
        reservation = await ReservationService.markNoShow(req.tenantId, reservationId);
      } else {
        reservation = await ReservationService.listReservations(req.tenantId);
      }

      res.json({ success: true, data: reservation });
    } catch (err) {
      next(err);
    }
  }

  public static async deleteReservation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.tenantId) {
        res.status(400).json({ success: false, message: 'Tenant context required' });
        return;
      }
      const reservationId = typeof req.params['id'] === 'string' ? req.params['id'] : undefined;
      if (!reservationId) {
        res.status(400).json({ success: false, message: 'Reservation ID required' });
        return;
      }
      await ReservationService.cancelReservation(req.tenantId, reservationId);
      res.json({ success: true, data: { message: 'Reservation cancelled' } });
    } catch (err) {
      next(err);
    }
  }
}
