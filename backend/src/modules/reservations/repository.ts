import { ReservationModel, type IReservation } from './model.js';
import { tenantQuery } from '../../utils/tenantQuery.js';

export class ReservationRepository {
  public static async create(tenantId: string, data: Partial<IReservation>): Promise<IReservation> {
    return tenantQuery.create(ReservationModel, tenantId, data);
  }

  public static async findById(tenantId: string, reservationId: string): Promise<IReservation | null> {
    return tenantQuery.findOne(ReservationModel, tenantId, { _id: reservationId });
  }

  public static async findAll(
    tenantId: string,
    branchId?: string,
    status?: string,
    dateRange?: { from: Date; to: Date }
  ): Promise<IReservation[]> {
    const query: Record<string, unknown> = {};
    if (branchId) query.branchId = branchId;
    if (status) query.status = status;
    if (dateRange) {
      query.reservedFor = {
        $gte: dateRange.from,
        $lte: dateRange.to,
      };
    }
    return tenantQuery.find(ReservationModel, tenantId, query).sort({ reservedFor: 1 });
  }

  public static async update(
    tenantId: string,
    reservationId: string,
    data: Partial<IReservation>
  ): Promise<IReservation | null> {
    return tenantQuery.findOneAndUpdate(
      ReservationModel,
      tenantId,
      { _id: reservationId },
      { $set: data },
      { new: true }
    );
  }

  public static async delete(tenantId: string, reservationId: string): Promise<boolean> {
    const result = await tenantQuery.deleteOne(ReservationModel, tenantId, { _id: reservationId });
    return result.deletedCount > 0;
  }
}
