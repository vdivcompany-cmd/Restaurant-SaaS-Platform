import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../../src/app.js';
import { TableService } from '../../src/modules/tables/service.js';
import { TableModel } from '../../src/modules/tables/model.js';
import { cacheService } from '../../src/services/cache/index.js';
import { TABLE_BINDING_TTL_SECONDS } from '../../src/modules/chat-sessions/service.js';

const app = createApp();

describe('Chat Sessions — Telegram Table Binding (n8n integration)', () => {
  const tableService = new TableService();

  let tenantIdA: string;
  let tenantIdB: string;
  let branchId: string;
  let tableIdA: string;

  beforeEach(async () => {
    tenantIdA = new mongoose.Types.ObjectId().toString();
    tenantIdB = new mongoose.Types.ObjectId().toString();
    branchId = new mongoose.Types.ObjectId().toString();

    const tableA = await tableService.createTable(tenantIdA, {
      branchId,
      number: 12,
      capacity: 4,
    });
    tableIdA = tableA._id.toString();
  });

  afterEach(async () => {
    await TableModel.deleteMany({ tenantId: { $in: [tenantIdA, tenantIdB] } });
    vi.restoreAllMocks();
  });

  it('1. saves a binding then fetches it — all fields round-trip', async () => {
    const chatId = '987654321';

    const saveRes = await request(app)
      .post('/api/v1/chat-sessions/save-table')
      .send({ chatId, tableId: tableIdA, tenantId: tenantIdA });

    expect(saveRes.status).toBe(200);
    expect(saveRes.body.success).toBe(true);
    expect(saveRes.body.data).toMatchObject({
      tenantId: tenantIdA,
      branchId,
      tableId: tableIdA,
      tableNumber: 12,
    });
    expect(saveRes.body.data.boundAt).toBeDefined();

    const contextRes = await request(app).get(`/api/v1/chat-sessions/context/${chatId}`);

    expect(contextRes.status).toBe(200);
    expect(contextRes.body.success).toBe(true);
    expect(contextRes.body.data).toMatchObject({
      tenantId: tenantIdA,
      branchId,
      tableId: tableIdA,
      tableNumber: 12,
    });
  });

  it('2. fetching a chatId with no binding returns 404', async () => {
    const res = await request(app).get('/api/v1/chat-sessions/context/no-such-chat-id');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('No table context bound for this chat');
  });

  it('3. cross-tenant isolation: bindings for different chatIds under different tenants never leak', async () => {
    const tableB = await tableService.createTable(tenantIdB, {
      branchId: new mongoose.Types.ObjectId().toString(),
      number: 5,
      capacity: 2,
    });
    const tableIdB = tableB._id.toString();

    const chatIdA = 'chat-tenant-a';
    const chatIdB = 'chat-tenant-b';

    await request(app)
      .post('/api/v1/chat-sessions/save-table')
      .send({ chatId: chatIdA, tableId: tableIdA, tenantId: tenantIdA });

    await request(app)
      .post('/api/v1/chat-sessions/save-table')
      .send({ chatId: chatIdB, tableId: tableIdB, tenantId: tenantIdB });

    const resA = await request(app).get(`/api/v1/chat-sessions/context/${chatIdA}`);
    const resB = await request(app).get(`/api/v1/chat-sessions/context/${chatIdB}`);

    expect(resA.body.data.tenantId).toBe(tenantIdA);
    expect(resA.body.data.tenantId).not.toBe(tenantIdB);
    expect(resB.body.data.tenantId).toBe(tenantIdB);
    expect(resB.body.data.tenantId).not.toBe(tenantIdA);

    await TableModel.deleteOne({ _id: tableIdB });
  });

  it('4. saveTableBinding persists with the configured 30-day TTL constant', async () => {
    const setSpy = vi.spyOn(cacheService, 'set');
    const chatId = 'ttl-check-chat';

    await request(app)
      .post('/api/v1/chat-sessions/save-table')
      .send({ chatId, tableId: tableIdA, tenantId: tenantIdA });

    expect(setSpy).toHaveBeenCalledWith(
      `table_binding:telegram:${chatId}`,
      expect.objectContaining({ tenantId: tenantIdA, tableId: tableIdA }),
      TABLE_BINDING_TTL_SECONDS
    );
    expect(TABLE_BINDING_TTL_SECONDS).toBe(30 * 24 * 60 * 60);
  });

  it('5. saving a binding for a non-existent table returns 404', async () => {
    const fakeTableId = new mongoose.Types.ObjectId().toString();

    const res = await request(app)
      .post('/api/v1/chat-sessions/save-table')
      .send({ chatId: 'chat-no-table', tableId: fakeTableId, tenantId: tenantIdA });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
