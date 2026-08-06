import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { TenantModel } from '../../src/modules/tenants/model.js';
import { MenuModel } from '../../src/modules/menu/model.js';
import { MenuUploadStatusModel } from '../../src/modules/menu/upload-status.model.js';
import { processMenuIngestionJob } from '../../src/workers/menu-ingestion.worker.js';

// ── Queue mock ────────────────────────────────────────────────────────────────
const { mockEnqueue, capturedPayloads } = vi.hoisted(() => {
  const capturedPayloads: Array<{ queueName: string; payload: unknown }> = [];
  const mockEnqueue = vi.fn(async (queueName: string, payload: unknown) => {
    capturedPayloads.push({ queueName, payload });
    return true;
  });
  return { mockEnqueue, capturedPayloads };
});

vi.mock('../../src/services/queue/index.js', () => ({
  queueService: {
    enqueue: mockEnqueue,
    assertQueues: vi.fn(async () => {}),
    consume: vi.fn(async () => {}),
  },
  PLATFORM_QUEUES: {
    MENU_INGESTION: { name: 'q.menu-ingestion' },
    VECTOR_SYNC: { name: 'q.vector-sync' },
    EMAILS: { name: 'q.emails' },
    TELEGRAM: { name: 'q.telegram' },
    INVOICES: { name: 'q.invoices' },
    SUBSCRIPTION_CHECKS: { name: 'q.subscription-checks' },
    PAYMENT_RETRIES: { name: 'q.payment-retries' },
    REPORTS: { name: 'q.reports' },
    BACKUPS: { name: 'q.backups' },
    FIRESTORE_RETRY: { name: 'q.firestore-retry' },
    TABLE_HISTORY_CLEANUP: { name: 'q.table-history-cleanup' },
  },
}));

const app = createApp();

async function setupTenantAndOwner(nameSuffix: string) {
  const tenant = await TenantModel.create({
    name: `Menu Consolidation Tenant ${nameSuffix}`,
    slug: `menu-consol-${nameSuffix}-${Date.now()}`,
    contact: { phone: '01012345678', email: `owner-${nameSuffix}@test.com` },
  });
  const tenantId = tenant._id.toString();

  const saRes = await request(app)
    .post('/api/v1/auth/register/super-admin')
    .send({ email: `sa-${nameSuffix}-${Date.now()}@test.com`, password: 'SuperSecurePassword123!' });
  const saToken = saRes.body.data.tokens.accessToken;

  const ownerRes = await request(app)
    .post('/api/v1/auth/register/owner')
    .set('Authorization', `Bearer ${saToken}`)
    .send({ tenantId, email: `owner-${nameSuffix}-${Date.now()}@test.com`, password: 'SuperSecurePassword123!' });
  const ownerToken = ownerRes.body.data.tokens.accessToken;

  return { tenantId, ownerToken, saToken };
}

describe('Menu Consolidation Integration Tests', () => {
  beforeEach(() => {
    capturedPayloads.length = 0;
    mockEnqueue.mockClear();
  });

  // ─── 1. JSON upload: synchronous, no queue ─────────────────────────────────
  it('POST /menu/upload with JSON body imports synchronously without queuing', async () => {
    const { tenantId, ownerToken } = await setupTenantAndOwner('json');

    const res = await request(app)
      .post('/api/v1/menu/upload')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Tenant-ID', tenantId)
      .send({
        categories: [
          {
            name: 'Desserts',
            products: [{ name: 'Kunafa', basePrice: 65, description: 'Sweet cheese pastry' }],
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.productsCount).toBe(1);

    // Verify product landed in MenuModel for this tenant
    const menu = await MenuModel.findOne({ tenantId });
    expect(menu).toBeDefined();
    expect(menu?.products.some((p) => p.name === 'Kunafa')).toBe(true);

    // Queue must NOT have been called for the MENU_INGESTION queue
    const ingestionCalls = capturedPayloads.filter((c) => c.queueName === 'q.menu-ingestion');
    expect(ingestionCalls).toHaveLength(0);
  });

  // ─── 2. CSV file upload: async, 202, queue job, worker processes it ────────
  it('POST /menu/upload with CSV file returns 202 and worker imports products', async () => {
    const { tenantId, ownerToken } = await setupTenantAndOwner('csv');

    const csvContent = 'category,name,price,description\nStarters,Hummus,45,Classic chickpea dip\nStarters,Falafel,35,Crispy falafel balls\n';
    const csvBuffer = Buffer.from(csvContent, 'utf8');

    const uploadRes = await request(app)
      .post('/api/v1/menu/upload')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Tenant-ID', tenantId)
      .attach('file', csvBuffer, { filename: 'menu.csv', contentType: 'text/csv' });

    expect(uploadRes.status).toBe(202);
    expect(uploadRes.body.data.statusId).toBeDefined();
    const { statusId } = uploadRes.body.data;

    // Verify queue was called once with MENU_INGESTION
    const ingestionCalls = capturedPayloads.filter((c) => c.queueName === 'q.menu-ingestion');
    expect(ingestionCalls).toHaveLength(1);

    // Simulate worker execution in-process
    const jobPayload = ingestionCalls[0]!.payload as any;
    await processMenuIngestionJob(jobPayload);

    // Poll status — should be completed
    const statusRes = await request(app)
      .get(`/api/v1/menu/uploads/${statusId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Tenant-ID', tenantId);
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.data.status).toBe('completed');
    expect(statusRes.body.data.resultProductsCount).toBe(2);

    // Verify products in catalog
    const catalogRes = await request(app)
      .get(`/api/v1/menu/catalog?tenantId=${tenantId}`)
      .set('X-Tenant-ID', tenantId);
    expect(catalogRes.status).toBe(200);
    const startersCat = catalogRes.body.data.categories.find((c: any) => c.name === 'Starters');
    expect(startersCat).toBeDefined();
    expect(startersCat.products.length).toBe(2);
  });

  // ─── 3. Cross-tenant isolation ─────────────────────────────────────────────
  it('tenant B cannot see tenant A uploaded products via GET /menu/catalog', async () => {
    const { tenantId: tenantIdA, ownerToken: tokenA } = await setupTenantAndOwner('iso-a');
    const { tenantId: tenantIdB } = await setupTenantAndOwner('iso-b');

    await request(app)
      .post('/api/v1/menu/upload')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('X-Tenant-ID', tenantIdA)
      .send({
        categories: [{ name: 'SecretMenu', products: [{ name: 'TopSecretItem', basePrice: 999 }] }],
      });

    const catalogB = await request(app)
      .get(`/api/v1/menu/catalog?tenantId=${tenantIdB}`)
      .set('X-Tenant-ID', tenantIdB);

    expect(catalogB.status).toBe(200);
    const leakedCat = catalogB.body.data.categories.find((c: any) => c.name === 'SecretMenu');
    expect(leakedCat).toBeUndefined();
  });

  // ─── 4. sourceDocuments grows per file upload ──────────────────────────────
  it('sourceDocuments array on MenuModel grows by one per CSV file upload', async () => {
    const { tenantId, ownerToken } = await setupTenantAndOwner('srcdoc');

    const csvContent = 'category,name,price\nDrinks,Water,10\n';
    const csvBuffer = Buffer.from(csvContent, 'utf8');

    const uploadRes = await request(app)
      .post('/api/v1/menu/upload')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Tenant-ID', tenantId)
      .attach('file', csvBuffer, { filename: 'drinks.csv', contentType: 'text/csv' });

    expect(uploadRes.status).toBe(202);

    // Run worker inline
    const jobPayload = capturedPayloads.find((c) => c.queueName === 'q.menu-ingestion')!.payload as any;
    await processMenuIngestionJob(jobPayload);

    const menu = await MenuModel.findOne({ tenantId });
    expect(menu?.sourceDocuments.length).toBeGreaterThanOrEqual(1);
    const srcDoc = menu?.sourceDocuments[menu.sourceDocuments.length - 1];
    expect(srcDoc?.fileType).toBe('csv');
    expect(srcDoc?.url).toMatch(/cloudinary|res\.cloudinary/i);
    expect(srcDoc?.originalFilename).toBe('drinks.csv');
  });

  // ─── 5. Single product delete triggers vector delete job ──────────────────
  it('DELETE /menu/products/:id removes from Mongo and enqueues delete-product vector sync', async () => {
    const { tenantId, ownerToken } = await setupTenantAndOwner('delete');

    const addRes = await request(app)
      .post('/api/v1/menu/products')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Tenant-ID', tenantId)
      .send({ name: 'Deletable Item', basePrice: 50 });
    expect(addRes.status).toBe(201);
    const productId = addRes.body.data._id;

    mockEnqueue.mockClear();
    capturedPayloads.length = 0;

    const deleteRes = await request(app)
      .delete(`/api/v1/menu/products/${productId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Tenant-ID', tenantId);
    expect(deleteRes.status).toBe(200);

    // Product removed from Mongo
    const menu = await MenuModel.findOne({ tenantId });
    expect(menu?.products.find((p) => p._id.toString() === productId)).toBeUndefined();

    // Vector delete-product job enqueued
    const vectorDeleteCall = capturedPayloads.find(
      (c) => c.queueName === 'q.vector-sync' && (c.payload as any)?.op === 'delete-product'
    );
    expect(vectorDeleteCall).toBeDefined();
    expect((vectorDeleteCall!.payload as any).productId).toBe(productId);
  });

  // ─── 6. Old /api/v1/products surface returns 404 (removed) ─────────────────
  it('GET /api/v1/products returns 404 — old duplicate surface is deleted', async () => {
    const res = await request(app).get('/api/v1/products');
    expect(res.status).toBe(404);
  });

  // ─── 7. /api/v1/menu-docs returns 404 ─────────────────────────────────────
  it('GET /api/v1/menu-docs returns 404 — module deleted', async () => {
    const res = await request(app).get('/api/v1/menu-docs');
    expect(res.status).toBe(404);
  });

  // ─── 8. /api/v1/menu-ingestion returns 404 ────────────────────────────────
  it('POST /api/v1/menu-ingestion/upload returns 404 — module deleted', async () => {
    const res = await request(app).post('/api/v1/menu-ingestion/upload');
    expect(res.status).toBe(404);
  });
});
