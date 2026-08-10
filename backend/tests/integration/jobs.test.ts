import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../../src/config/database.js';
import { processEmailJob } from '../../src/workers/email.worker.js';
import { handleTableHistoryCleanup } from '../../src/workers/table-history-cleanup.worker.js';
import { OrderModel } from '../../src/modules/orders/model.js';

describe('QStash Job Handlers Integration Tests', () => {
  const testTenantId = new mongoose.Types.ObjectId().toString();

  beforeAll(async () => {
    await connectDatabase();
  });

  afterAll(async () => {
    await OrderModel.deleteMany({ tenantId: testTenantId });
    await disconnectDatabase();
  });

  it('processEmailJob: executes successfully without error', async () => {
    await expect(
      processEmailJob(
        {
          to: 'test@example.com',
          subject: 'Test Subject',
          template: 'WELCOME',
          context: { name: 'Test User', restaurantName: 'Test Diner' },
          tenantId: testTenantId,
        },
        { 'x-tenant-id': testTenantId }
      )
    ).resolves.toBeUndefined();
  });

  it('handleTableHistoryCleanup: purges orders older than 30 days for specified table', async () => {
    const tenantId = testTenantId;
    const oldDate = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000); // 40 days ago

    const oldOrder = await OrderModel.create({
      tenantId,
      branchId: new mongoose.Types.ObjectId().toString(),
      orderNumber: 'ORD-OLD-001',
      items: [{ productId: new mongoose.Types.ObjectId().toString(), name: 'Burger', quantity: 1, unitPrice: 50, totalPrice: 50 }],
      subtotal: 50,
      totalAmount: 50,
      status: 'PAID',
      tableId: new mongoose.Types.ObjectId().toString(),
      createdAt: oldDate,
    });

    const recentOrder = await OrderModel.create({
      tenantId,
      branchId: new mongoose.Types.ObjectId().toString(),
      orderNumber: 'ORD-REC-001',
      items: [{ productId: new mongoose.Types.ObjectId().toString(), name: 'Pizza', quantity: 1, unitPrice: 100, totalPrice: 100 }],
      subtotal: 100,
      totalAmount: 100,
      status: 'PAID',
      tableId: new mongoose.Types.ObjectId().toString(),
      createdAt: new Date(),
    });

    await handleTableHistoryCleanup({ cutoffDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() });

    const checkOld = await OrderModel.findById(oldOrder._id);
    const checkRecent = await OrderModel.findById(recentOrder._id);

    expect(checkOld).toBeNull();
    expect(checkRecent).not.toBeNull();
  });
});
