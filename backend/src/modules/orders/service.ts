import { withTransactionOrFallback } from '../../utils/withTransactionOrFallback.js';
import { OrderRepository } from './repository.js';
import { TableModel } from '../tables/model.js';
import { TableService } from '../tables/service.js';
import { realtimeService } from '../../services/realtime/index.js';
import { queueService, PLATFORM_QUEUES } from '../../services/queue/index.js';
import { eventBus } from '../../shared/events/index.js';
import { tenantQuery } from '../../utils/tenantQuery.js';
import type { IOrder } from './model.js';
import type {
  CreateOrderDto,
  CreateCustomerOrderDto,
  UpdateOrderStatusDto,
  CashierConfirmDto,
  KitchenCompleteDto,
  OfflineSyncDto,
} from './validation.js';
import { AppError } from '../../middleware/errorHandler.middleware.js';

import { BranchRepository } from '../branches/repository.js';
import { CustomerRepository } from '../customers/repository.js';
import { CouponService } from '../coupons/service.js';

export class OrderService {
  private repo = new OrderRepository();
  private branchRepo = new BranchRepository();
  private tableService = new TableService();
  private customerRepo = new CustomerRepository();
  private couponService = new CouponService();

  public async createOrder(
    tenantId: string,
    dto: CreateOrderDto,
    opts?: { skipSessionCheck?: boolean }
  ): Promise<IOrder> {
    if (dto.offlineGuid) {
      const existing = await this.repo.findByOfflineGuid(tenantId, dto.offlineGuid);
      if (existing) {
        return existing;
      }
    }

    let targetBranchId = dto.branchId;
    if (!targetBranchId) {
      const branches = await this.branchRepo.findAll(tenantId);
      if (!branches || branches.length === 0) {
        throw new AppError('No branches found for this restaurant. Please create a branch first.', 400);
      }
      if (branches.length === 1 && branches[0]) {
        targetBranchId = branches[0]._id.toString();
      } else {
        throw new AppError('Multiple branches found for this restaurant. branchId is required.', 400);
      }
    }

    const finalBranchId = targetBranchId;

    // Build embedded customer object
    const embeddedCustomer = dto.customer || {
      name: dto.customerName || (dto.channel === 'DINE_IN' ? `Table Guest` : 'Customer'),
      phone: dto.customerPhone,
      deliveryAddress: dto.deliveryAddress,
    };

    // Coupon calculation if code provided
    let calculatedDiscount = dto.discountAmount || 0;
    let appliedCouponId: any = undefined;
    let appliedCouponCode: string | undefined = undefined;

    if (dto.couponCode && dto.couponCode.trim()) {
      const couponRes = await this.couponService.validateCoupon(tenantId, dto.couponCode, dto.subtotal);
      if (!couponRes.valid || !couponRes.coupon) {
        throw new AppError(couponRes.reason || 'Invalid or expired coupon code', 400);
      }
      appliedCouponCode = couponRes.coupon.code;
      appliedCouponId = couponRes.coupon.id;
      calculatedDiscount = couponRes.discountAmount ?? calculatedDiscount;
      void this.couponService.recordCouponUsage(tenantId, couponRes.coupon.id).catch(() => null);
    }

    const subtotal = dto.subtotal;
    const taxAmount = dto.taxAmount || 0;
    const totalAmount = Math.max(0, Math.round((subtotal - calculatedDiscount + taxAmount) * 100) / 100);

    const orderPayload = {
      ...dto,
      branchId: finalBranchId,
      customer: embeddedCustomer,
      customerName: embeddedCustomer.name,
      customerPhone: embeddedCustomer.phone,
      deliveryAddress: embeddedCustomer.deliveryAddress,
      subtotal,
      discountAmount: calculatedDiscount,
      totalAmount,
      ...(appliedCouponCode ? { couponCode: appliedCouponCode, couponId: appliedCouponId } : {}),
    };

    // Fraud prevention: DINE_IN orders require proof of an open table session
    if (!opts?.skipSessionCheck && dto.channel === 'DINE_IN' && dto.tableId) {
      await this.tableService.validateTableSession(tenantId, dto.tableId, dto.tableSessionId);
    }

    const orderNumber = `ORD-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
    
    const orderDoc = await withTransactionOrFallback(async (session) => {
      const createdOrder = await this.repo.create(tenantId, { ...orderPayload, orderNumber }, session);

      if (dto.tableId && dto.channel === 'DINE_IN') {
        const query = tenantQuery.updateOne(TableModel, tenantId, {
          _id: dto.tableId,
          branchId: finalBranchId,
        }, { status: 'OCCUPIED', currentOrderId: createdOrder._id }, { session: session ?? undefined });
        await query.exec();
      }
      return createdOrder;
    });

    // 1. Publish to active_orders projection
    const firestorePath = realtimeService.getTenantPath(tenantId, 'active_orders', orderDoc._id.toString());
    void realtimeService.publishSafe(firestorePath, {
      orderNumber: orderDoc.orderNumber,
      status: orderDoc.status,
      items: orderDoc.items,
      branchId: finalBranchId,
      customer: orderDoc.customer,
      subtotal: orderDoc.subtotal,
      discountAmount: orderDoc.discountAmount,
      totalAmount: orderDoc.totalAmount,
      tableId: orderDoc.tableId,
    }, tenantId);

    // 2. Real-time projection to Cashier incoming queue
    const cashierPath = realtimeService.getTenantPath(tenantId, 'cashier_orders', orderDoc._id.toString());
    void realtimeService.publishSafe(cashierPath, {
      orderId: orderDoc._id.toString(),
      orderNumber: orderDoc.orderNumber,
      status: 'PENDING',
      channel: orderDoc.channel,
      items: orderDoc.items,
      customer: orderDoc.customer,
      subtotal: orderDoc.subtotal,
      discountAmount: orderDoc.discountAmount,
      totalAmount: orderDoc.totalAmount,
      tableId: orderDoc.tableId,
      createdAt: orderDoc.createdAt,
    }, tenantId);

    eventBus.emitEvent('order.created_for_cashier', {
      tenantId,
      branchId: finalBranchId,
      orderId: orderDoc._id.toString(),
      totalAmount: orderDoc.totalAmount,
    });

    const queueName = PLATFORM_QUEUES['INVOICES']?.name ?? 'q.invoices';
    await queueService.enqueue(queueName, { orderId: orderDoc._id }, { tenantId });

    return orderDoc;
  }

  /**
   * Public self-service order for takeaway / delivery customers.
   * Embeds customer details and calculates all prices securely.
   */
  public async createCustomerOrder(
    tenantId: string,
    dto: CreateCustomerOrderDto & {
      items: any[];
      subtotal: number;
      taxAmount?: number;
      totalAmount: number;
    }
  ): Promise<IOrder> {
    // Upsert customer record in background for marketing / CRM
    void this.customerRepo.upsertByPhone(tenantId, dto.customerName, dto.customerPhone).catch(() => null);

    const embeddedCustomer = {
      name: dto.customerName,
      phone: dto.customerPhone,
      email: (dto as any).customerEmail,
      deliveryAddress: dto.deliveryAddress,
      notes: dto.notes,
    };

    const orderDto = {
      ...dto,
      customer: embeddedCustomer,
      customerName: dto.customerName,
      customerPhone: dto.customerPhone,
      deliveryAddress: dto.deliveryAddress,
    } as any;

    return await this.createOrder(tenantId, orderDto, { skipSessionCheck: true });
  }

  /**
   * Step 1: Cashier confirms incoming order -> dispatches ticket to Kitchen KDS
   */
  public async confirmByCashier(
    tenantId: string,
    orderId: string,
    cashierUserId?: string,
    dto?: CashierConfirmDto
  ): Promise<IOrder> {
    const order = await this.repo.confirmByCashier(tenantId, orderId, cashierUserId, dto?.notes);
    if (!order) throw new AppError('Order not found or out of scope', 404);

    // Update active_orders projection
    const activePath = realtimeService.getTenantPath(tenantId, 'active_orders', order._id.toString());
    void realtimeService.publishSafe(activePath, { status: 'CONFIRMED' }, tenantId);

    // Update cashier_orders projection
    const cashierPath = realtimeService.getTenantPath(tenantId, 'cashier_orders', order._id.toString());
    void realtimeService.publishSafe(cashierPath, { status: 'CONFIRMED', confirmedAt: new Date() }, tenantId);

    // Dispatch in real-time to Kitchen KDS queue
    const kitchenPath = realtimeService.getTenantPath(tenantId, 'kitchen_orders', order._id.toString());
    void realtimeService.publishSafe(kitchenPath, {
      orderId: order._id.toString(),
      orderNumber: order.orderNumber,
      channel: order.channel,
      status: 'CONFIRMED',
      items: order.items,
      tableId: order.tableId,
      customerNotes: order.customer?.notes,
      receivedAt: new Date(),
    }, tenantId);

    eventBus.emitEvent('order.sent_to_kitchen', {
      tenantId,
      branchId: order.branchId.toString(),
      orderId: order._id.toString(),
      ...(cashierUserId ? { cashierId: cashierUserId } : {}),
    });

    return order;
  }

  /**
   * Step 2: Kitchen marks preparation as READY / Done -> alerts Cashier & Customer
   */
  public async completeByKitchen(
    tenantId: string,
    orderId: string,
    kitchenUserId?: string,
    dto?: KitchenCompleteDto
  ): Promise<IOrder> {
    const order = await this.repo.completeByKitchen(tenantId, orderId, kitchenUserId, dto?.kitchenNotes);
    if (!order) throw new AppError('Order not found or out of scope', 404);

    // Update projections
    const activePath = realtimeService.getTenantPath(tenantId, 'active_orders', order._id.toString());
    void realtimeService.publishSafe(activePath, { status: 'READY' }, tenantId);

    const kitchenPath = realtimeService.getTenantPath(tenantId, 'kitchen_orders', order._id.toString());
    void realtimeService.publishSafe(kitchenPath, { status: 'READY', completedAt: new Date() }, tenantId);

    const cashierPath = realtimeService.getTenantPath(tenantId, 'cashier_orders', order._id.toString());
    void realtimeService.publishSafe(cashierPath, { status: 'READY', kitchenReadyAt: new Date() }, tenantId);

    eventBus.emitEvent('order.kitchen_ready', {
      tenantId,
      branchId: order.branchId.toString(),
      orderId: order._id.toString(),
      ...(kitchenUserId ? { kitchenStaffId: kitchenUserId } : {}),
    });

    return order;
  }

  /**
   * Step 3: Cashier or Kitchen finalizes order -> status COMPLETED
   */
  public async completeOrder(tenantId: string, orderId: string): Promise<IOrder> {
    const order = await this.repo.completeOrder(tenantId, orderId);
    if (!order) throw new AppError('Order not found or out of scope', 404);

    if (order.tableId) {
      await tenantQuery.updateOne(TableModel, tenantId, { _id: order.tableId }, {
        $set: { status: 'AVAILABLE', currentOrderId: null },
        $inc: { totalOrdersServed: 1 },
      }).exec();

      void this.tableService.closeTableSession(tenantId, order.tableId.toString()).catch(() => null);
    }

    // Clean up active real-time projections
    const activePath = realtimeService.getTenantPath(tenantId, 'active_orders', order._id.toString());
    const cashierPath = realtimeService.getTenantPath(tenantId, 'cashier_orders', order._id.toString());
    const kitchenPath = realtimeService.getTenantPath(tenantId, 'kitchen_orders', order._id.toString());

    void realtimeService.delete(activePath).catch(() => null);
    void realtimeService.delete(cashierPath).catch(() => null);
    void realtimeService.delete(kitchenPath).catch(() => null);

    eventBus.emitEvent('order.completed', {
      tenantId,
      branchId: order.branchId.toString(),
      orderId: order._id.toString(),
      totalAmount: order.totalAmount,
    });

    return order;
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

      await this.createOrder(tenantId, { ...orderDto, branchId: dto.branchId }, { skipSessionCheck: true });
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

    const isTerminal = dto.status === 'PAID' || dto.status === 'COMPLETED' || dto.status === 'CANCELLED';

    if (isTerminal && order.tableId) {
      const updateQuery: Record<string, unknown> = {
        $set: { status: 'AVAILABLE', currentOrderId: null },
      };
      if (dto.status === 'PAID' || dto.status === 'COMPLETED') {
        updateQuery['$inc'] = { totalOrdersServed: 1 };
      }
      await tenantQuery.updateOne(TableModel, tenantId, { _id: order.tableId }, updateQuery).exec();

      void this.tableService.closeTableSession(tenantId, order.tableId.toString()).catch(() => null);
    }

    const firestorePath = realtimeService.getTenantPath(tenantId, 'active_orders', order._id.toString());
    if (isTerminal) {
      void realtimeService.delete(firestorePath).catch(() => null);
      void realtimeService.delete(realtimeService.getTenantPath(tenantId, 'cashier_orders', order._id.toString())).catch(() => null);
      void realtimeService.delete(realtimeService.getTenantPath(tenantId, 'kitchen_orders', order._id.toString())).catch(() => null);
    } else {
      void realtimeService.publishSafe(firestorePath, { status: dto.status }, tenantId);
    }

    return order;
  }
}

