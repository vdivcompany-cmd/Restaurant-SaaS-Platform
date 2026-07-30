import type { ClientSession } from 'mongoose';
import { OrderModel, type IOrder } from './model.js';
import { tenantQuery } from '../../utils/tenantQuery.js';
import type { CreateOrderDto, UpdateOrderStatusDto } from './validation.js';

export class OrderRepository {
  public async create(tenantId: string, data: CreateOrderDto & { orderNumber: string }, session?: ClientSession): Promise<IOrder> {
    const [created] = (await OrderModel.create([{ ...data, tenantId } as any], session ? { session } : undefined)) as unknown as IOrder[];
    return created as IOrder;
  }

  public async findByOfflineGuid(tenantId: string, guid: string): Promise<IOrder | null> {
    return await tenantQuery.findOne(OrderModel, tenantId, { offlineGuid: guid }).exec();
  }

  public async findAll(tenantId: string, branchId?: string): Promise<IOrder[]> {
    const filter: Record<string, unknown> = {};
    if (branchId) filter['branchId'] = branchId;
    return await tenantQuery.find(OrderModel, tenantId, filter).sort({ createdAt: -1 }).exec();
  }

  public async findById(tenantId: string, orderId: string): Promise<IOrder | null> {
    return await tenantQuery.findOne(OrderModel, tenantId, { _id: orderId }).exec();
  }

  public async updateStatus(tenantId: string, orderId: string, data: UpdateOrderStatusDto): Promise<IOrder | null> {
    return await tenantQuery.findOneAndUpdate(OrderModel, tenantId, { _id: orderId }, { status: data.status }, { new: true }).exec();
  }
}
