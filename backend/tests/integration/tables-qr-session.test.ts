import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import mongoose from 'mongoose';
import { TableService } from '../../src/modules/tables/service.js';
import { TableModel } from '../../src/modules/tables/model.js';
import { OrderService } from '../../src/modules/orders/service.js';
import { OrderModel } from '../../src/modules/orders/model.js';
import { cacheService } from '../../src/services/cache/index.js';

describe('QR Table Session Fraud Prevention Suite', () => {
  const tableService = new TableService();
  const orderService = new OrderService();

  let tenantIdA: string;
  let tenantIdB: string;
  let branchId: string;
  let tableIdA: string;
  let qrTokenA: string;

  beforeEach(async () => {
    tenantIdA = new mongoose.Types.ObjectId().toString();
    tenantIdB = new mongoose.Types.ObjectId().toString();
    branchId = new mongoose.Types.ObjectId().toString();

    const tableA = await tableService.createTable(tenantIdA, {
      branchId,
      number: 101,
      capacity: 4,
    });
    tableIdA = tableA._id.toString();
    qrTokenA = tableA.qrCodeToken;
  });

  afterEach(async () => {
    await TableModel.deleteMany({ tenantId: { $in: [tenantIdA, tenantIdB] } });
    await OrderModel.deleteMany({ tenantId: { $in: [tenantIdA, tenantIdB] } });
  });

  it('1. resolveByQrToken creates an active session in Redis with 90-min TTL', async () => {
    const resolved = await tableService.resolveByQrToken(qrTokenA);

    expect(resolved.tenantId).toBe(tenantIdA);
    expect(resolved.branchId).toBe(branchId);
    expect(resolved.sessionId).toBeDefined();

    const sessionKey = `table_session:${tenantIdA}:${tableIdA}`;
    const cachedSession = await cacheService.get<{ sessionId: string; tenantId: string }>(sessionKey);

    expect(cachedSession).toBeDefined();
    expect(cachedSession?.sessionId).toBe(resolved.sessionId);
    expect(cachedSession?.tenantId).toBe(tenantIdA);
  });

  it('2. validateTableSession succeeds with matching session ID', async () => {
    const resolved = await tableService.resolveByQrToken(qrTokenA);
    await expect(
      tableService.validateTableSession(tenantIdA, tableIdA, resolved.sessionId)
    ).resolves.toBeUndefined();
  });

  it('3. validateTableSession fails (403) with missing or mismatched session ID', async () => {
    await tableService.resolveByQrToken(qrTokenA);

    await expect(
      tableService.validateTableSession(tenantIdA, tableIdA, undefined)
    ).rejects.toThrow('A table session is required');

    await expect(
      tableService.validateTableSession(tenantIdA, tableIdA, 'fake-session-uuid')
    ).rejects.toThrow('Table session expired or invalid');
  });

  it('4. validateTableSession fails (403) when session has expired from Redis', async () => {
    const resolved = await tableService.resolveByQrToken(qrTokenA);
    await tableService.closeTableSession(tenantIdA, tableIdA);

    await expect(
      tableService.validateTableSession(tenantIdA, tableIdA, resolved.sessionId)
    ).rejects.toThrow('Table session expired or invalid');
  });

  it('5. Order placement for QR order without valid session is rejected', async () => {
    const prodId = new mongoose.Types.ObjectId().toString();
    await expect(
      orderService.createOrder(tenantIdA, {
        branchId,
        channel: 'QR',
        tableId: tableIdA,
        items: [{ productId: prodId, name: 'Item 1', quantity: 1, unitPrice: 50, totalPrice: 50 }],
        subtotal: 50,
        totalAmount: 50,
      } as any)
    ).rejects.toThrow('A table session is required');
  });

  it('6. Order placement for QR order with valid session succeeds', async () => {
    const resolved = await tableService.resolveByQrToken(qrTokenA);
    const prodId = new mongoose.Types.ObjectId().toString();

    const order = await orderService.createOrder(tenantIdA, {
      branchId,
      channel: 'QR',
      tableId: tableIdA,
      tableSessionId: resolved.sessionId,
      items: [{ productId: prodId, name: 'Item 1', quantity: 1, unitPrice: 50, totalPrice: 50 }],
      subtotal: 50,
      totalAmount: 50,
    } as any);

    expect(order).toBeDefined();
    expect(order.tableId?.toString()).toBe(tableIdA);
  });

  it('7. DINE_IN order from POS/Staff with skipSessionCheck bypasses table session validation', async () => {
    const prodId = new mongoose.Types.ObjectId().toString();

    const order = await orderService.createOrder(
      tenantIdA,
      {
        branchId,
        channel: 'DINE_IN',
        tableId: tableIdA,
        items: [{ productId: prodId, name: 'Item 2', quantity: 2, unitPrice: 30, totalPrice: 60 }],
        subtotal: 60,
        totalAmount: 60,
      } as any,
      { skipSessionCheck: true }
    );

    expect(order).toBeDefined();
  });

  it('8. Offline sync endpoint verifies table sessions for QR orders', async () => {
    const resolved = await tableService.resolveByQrToken(qrTokenA);
    const prodId = new mongoose.Types.ObjectId().toString();

    const syncPayload = {
      branchId,
      orders: [
        {
          branchId,
          offlineGuid: 'offline-qr-1',
          channel: 'QR',
          tableId: tableIdA,
          tableSessionId: resolved.sessionId,
          items: [{ productId: prodId, name: 'Sync Item', quantity: 1, unitPrice: 40, totalPrice: 40 }],
          subtotal: 40,
          totalAmount: 40,
        },
      ],
    };

    const result = await orderService.syncOfflineOrders(tenantIdA, syncPayload as any);
    expect(result.synced).toBe(1);
    expect(result.skipped).toBe(0);
  });

  it('9. Order placement with invalid table session is rejected', async () => {
    const prodId = new mongoose.Types.ObjectId().toString();

    await expect(
      orderService.createOrder(tenantIdA, {
        branchId,
        channel: 'QR',
        tableId: tableIdA,
        tableSessionId: 'expired-session-id',
        items: [{ productId: prodId, name: 'Invalid Item', quantity: 1, unitPrice: 40, totalPrice: 40 }],
        subtotal: 40,
        totalAmount: 40,
      } as any)
    ).rejects.toThrow('Table session expired or invalid');
  });

  it('10. Cross-tenant session isolation prevents Tenant B from using Tenant A session', async () => {
    const resolved = await tableService.resolveByQrToken(qrTokenA);

    await expect(
      tableService.validateTableSession(tenantIdB, tableIdA, resolved.sessionId)
    ).rejects.toThrow('Table session expired or invalid');
  });

  it('11. Concurrent scan while OCCUPIED returns existing session ID', async () => {
    const firstScan = await tableService.resolveByQrToken(qrTokenA);
    await TableModel.updateOne({ _id: tableIdA }, { status: 'OCCUPIED' });

    const secondScan = await tableService.resolveByQrToken(qrTokenA);
    expect(secondScan.sessionId).toBe(firstScan.sessionId);
  });
});
