import { withTransactionOrFallback } from '../../utils/withTransactionOrFallback.js';
import { OrderRepository } from './repository.js';
import { TableModel } from '../tables/model.js';
import { realtimeService } from '../../services/realtime/index.js';
import { queueService, PLATFORM_QUEUES } from '../../services/queue/index.js';
import { eventBus } from '../../shared/events/index.js';
import { tenantQuery } from '../../utils/tenantQuery.js';
import type { IOrder } from './model.js';
import type { CreateOrderDto, UpdateOrderStatusDto, OfflineSyncDto } from './validation.js';
import { AppError } from '../../middleware/errorHandler.middleware.js';

export class OrderService {
  private repo = new OrderRepository();

  public async createOrder(tenantId: string, dto: CreateOrderDto): Promise<IOrder> {
    if (dto.offlineGuid) {
      const existing = await this.repo.findByOfflineGuid(tenantId, dto.offlineGuid);
      if (existing) {
        return existing;
      }
    }

    const orderNumber = `ORD-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
    
    const orderDoc = await withTransactionOrFallback(async (session) => {
      const createdOrder = await this.repo.create(tenantId, { ...dto, orderNumber }, session);

      if (dto.tableId && dto.channel === 'DINE_IN') {
        const query = tenantQuery.updateOne(TableModel, tenantId, {
          _id: dto.tableId,
          branchId: dto.branchId,
        }, { status: 'OCCUPIED', currentOrderId: createdOrder._id }, { session: session ?? undefined });
        await query.exec();
      }
      return createdOrder;
    });

    const firestorePath = realtimeService.getTenantPath(tenantId, 'active_orders', orderDoc._id.toString());
    // publishSafe: catches Firestore failures and enqueues retry via q.firestore-retry (Rule #3)
    void realtimeService.publishSafe(firestorePath, {
      orderNumber: orderDoc.orderNumber,
      status: orderDoc.status,
      items: orderDoc.items,
      branchId: dto.branchId,
    }, tenantId);

    eventBus.emitEvent('order.completed', {
      tenantId,
      branchId: dto.branchId,
      orderId: orderDoc._id.toString(),
      totalAmount: orderDoc.totalAmount,
    });

    const queueName = PLATFORM_QUEUES['INVOICES']?.name ?? 'q.invoices';
    await queueService.enqueue(queueName, { orderId: orderDoc._id }, { tenantId });

    return orderDoc;
  }

  public async syncOfflineOrders(tenantId: string, dto: OfflineSyncDto): Promise<{ synced: number; skipped: number }> {
    let synced = 0;
    let skipped = 0;

    for (const orderDto of dto.orders) {
      if (!orderDto.offlineGuid) {
        skipped++;
        continue;
      }
      const exists = await this.repo.findByOfflineGuid(tenantId, orderDto.offlineGuid);
      if (exists) {
        skipped++;
        continue;
      }

      await this.createOrder(tenantId, { ...orderDto, branchId: dto.branchId });
      synced++;
    }

    return { synced, skipped };
  }

  public async listOrders(tenantId: string, branchId?: string): Promise<IOrder[]> {
    return await this.repo.findAll(tenantId, branchId);
  }

  public async getOrder(tenantId: string, orderId: string): Promise<IOrder> {
    const order = await this.repo.findById(tenantId, orderId);
    if (!order) throw new AppError('Order not found or out of scope', 404);
    return order;
  }

  public async updateOrderStatus(tenantId: string, orderId: string, dto: UpdateOrderStatusDto): Promise<IOrder> {
    const order = await this.repo.updateStatus(tenantId, orderId, dto);
    if (!order) throw new AppError('Order not found or out of scope', 404);

    if ((dto.status === 'PAID' || dto.status === 'CANCELLED') && order.tableId) {
      const updateQuery: Record<string, unknown> = {
        $set: { status: 'AVAILABLE', currentOrderId: null },
      };
      // Only increment totalOrdersServed on PAID, not on CANCELLED
      if (dto.status === 'PAID') {
        updateQuery['$inc'] = { totalOrdersServed: 1 };
      }
      await tenantQuery.updateOne(TableModel, tenantId, { _id: order.tableId }, updateQuery).exec();
    }

    const firestorePath = realtimeService.getTenantPath(tenantId, 'active_orders', order._id.toString());
    if (dto.status === 'PAID' || dto.status === 'CANCELLED') {
      // delete is fire-and-forget: removal failure only means a stale projection — acceptable
      void realtimeService.delete(firestorePath).catch(() => null);
    } else {
      // publishSafe: catches Firestore failures and enqueues retry via q.firestore-retry (Rule #3)
      void realtimeService.publishSafe(firestorePath, { status: dto.status }, tenantId);
    }

    return order;
  }
}
