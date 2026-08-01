import { ReservationRepository } from './repository.js';
import { TableModel } from '../tables/model.js';
import { queueService, PLATFORM_QUEUES } from '../../services/queue/index.js';
import { tenantQuery } from '../../utils/tenantQuery.js';
import type { IReservation } from './model.js';
import type { CreateReservationInput, UpdateReservationInput } from './validation.js';
import { AppError } from '../../middleware/errorHandler.middleware.js';

const RESERVATION_OVERLAP_WINDOW_MS = 2 * 60 * 60 * 1000; // 2-hour overlap window

export class ReservationService {
  public static async createReservation(
    tenantId: string,
    dto: CreateReservationInput
  ): Promise<IReservation> {
    // If table is specified, verify availability (no overlapping confirmed/pending reservations)
    if (dto.tableId) {
      const table = await tenantQuery.findOne(TableModel, tenantId, { _id: dto.tableId });
      if (!table) {
        throw new AppError('Table not found or out of scope', 404);
      }

      const reservedTime = new Date(dto.reservedFor);
      const overlapStart = new Date(reservedTime.getTime() - RESERVATION_OVERLAP_WINDOW_MS);
      const overlapEnd = new Date(reservedTime.getTime() + RESERVATION_OVERLAP_WINDOW_MS);

      const existing = await ReservationRepository.findAll(tenantId, dto.branchId.toString(), undefined, {
        from: overlapStart,
        to: overlapEnd,
      });
      const conflict = existing.some(
        (res) =>
          res.tableId?.toString() === dto.tableId?.toString() &&
          ['CONFIRMED', 'PENDING'].includes(res.status)
      );

      if (conflict) {
        throw new AppError('Table is already reserved for that time window', 409);
      }
    }

    const reservation = await ReservationRepository.create(tenantId, dto as any);

    // Queue confirmation notification (chatbot channel)
    if (dto.channel) {
      const queueName = PLATFORM_QUEUES['TELEGRAM']?.name ?? 'q.telegram';
      await queueService.enqueue(
        queueName,
        {
          recipientPhone: dto.customerPhone,
          message: `Your reservation for ${dto.partySize} people on ${dto.reservedFor} has been received.`,
        },
        { tenantId }
      );
    }

    return reservation;
  }

  public static async confirmReservation(
    tenantId: string,
    reservationId: string,
    dto: UpdateReservationInput
  ): Promise<IReservation> {
    const reservation = await ReservationRepository.findById(tenantId, reservationId);
    if (!reservation) {
      throw new AppError('Reservation not found or out of scope', 404);
    }

    const updated = await ReservationRepository.update(tenantId, reservationId, {
      ...dto,
      status: 'CONFIRMED',
    } as any);
    if (!updated) throw new AppError('Failed to confirm reservation', 500);

    // If a table is assigned, mark it as RESERVED
    if (updated.tableId) {
      await tenantQuery
        .updateOne(TableModel, tenantId, { _id: updated.tableId }, { status: 'RESERVED' })
        .exec();
    }

    return updated;
  }

  public static async markSeated(tenantId: string, reservationId: string): Promise<IReservation> {
    const reservation = await ReservationRepository.findById(tenantId, reservationId);
    if (!reservation) {
      throw new AppError('Reservation not found or out of scope', 404);
    }

    const updated = await ReservationRepository.update(tenantId, reservationId, {
      status: 'SEATED',
    });
    if (!updated) throw new AppError('Failed to seat reservation', 500);

    // Mark table as OCCUPIED (will be managed by order creation)
    if (updated.tableId) {
      await tenantQuery
        .updateOne(TableModel, tenantId, { _id: updated.tableId }, { status: 'OCCUPIED' })
        .exec();
    }

    return updated;
  }

  public static async cancelReservation(tenantId: string, reservationId: string): Promise<IReservation> {
    const reservation = await ReservationRepository.findById(tenantId, reservationId);
    if (!reservation) {
      throw new AppError('Reservation not found or out of scope', 404);
    }

    const updated = await ReservationRepository.update(tenantId, reservationId, {
      status: 'CANCELLED',
    });
    if (!updated) throw new AppError('Failed to cancel reservation', 500);

    // Release table if one was held
    if (updated.tableId) {
      await tenantQuery
        .updateOne(TableModel, tenantId, { _id: updated.tableId }, { status: 'AVAILABLE' })
        .exec();
    }

    return updated;
  }

  public static async markNoShow(tenantId: string, reservationId: string): Promise<IReservation> {
    const reservation = await ReservationRepository.findById(tenantId, reservationId);
    if (!reservation) {
      throw new AppError('Reservation not found or out of scope', 404);
    }

    const updated = await ReservationRepository.update(tenantId, reservationId, {
      status: 'NO_SHOW',
    });
    if (!updated) throw new AppError('Failed to mark no-show', 500);

    // Release table
    if (updated.tableId) {
      await tenantQuery
        .updateOne(TableModel, tenantId, { _id: updated.tableId }, { status: 'AVAILABLE' })
        .exec();
    }

    return updated;
  }

  public static async listReservations(
    tenantId: string,
    branchId?: string,
    status?: string,
    dateRange?: { from: Date; to: Date }
  ): Promise<IReservation[]> {
    return ReservationRepository.findAll(tenantId, branchId, status, dateRange);
  }
}
