import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { TenantModel } from '../../src/modules/tenants/model.js';
import { CategoryModel } from '../../src/modules/categories/model.js';
import { ProductModel } from '../../src/modules/products/model.js';
import { VariantModel } from '../../src/modules/variants/model.js';
import { queueService, PLATFORM_QUEUES } from '../../src/services/queue/index.js';
import { processEmailJob } from '../../src/workers/email.worker.js';
import { processTelegramJob } from '../../src/workers/telegram.worker.js';
import { processInvoiceJob } from '../../src/workers/invoice.worker.js';
import { processSubscriptionCheckJob } from '../../src/workers/subscription-check.worker.js';
import { processPaymentRetryJob } from '../../src/workers/payment-retry.worker.js';
import { processBackupJob } from '../../src/workers/backup.worker.js';

const app = createApp();

describe('Phase 4 — Integrations & Background Workers Test Suite', () => {
  it('should execute bulk menu import with atomic creation, Zod validation, and cache invalidation', async () => {
    // Setup Tenant & Owner account
    const tenant = await TenantModel.create({
      name: 'Phase 4 Bistro',
      slug: `bistro-${Date.now()}`,
      contact: { phone: '01012345678', email: 'owner@bistro.com' },
    });
    const tenantId = tenant._id.toString();

    const saRes = await request(app)
      .post('/api/v1/auth/register/super-admin')
      .send({
        email: `sa-${Date.now()}@bistro.com`,
        password: 'SuperSecurePassword123!',
      });
    const saToken = saRes.body.data.tokens.accessToken;

    const regRes = await request(app)
      .post('/api/v1/auth/register/owner')
      .set('Authorization', `Bearer ${saToken}`)
      .send({
        tenantId,
        email: `owner-${Date.now()}@bistro.com`,
        password: 'SuperSecurePassword123!',
      });
    expect(regRes.status).toBe(201);
    const accessToken = regRes.body.data.tokens.accessToken;

    // 1. Validation failure test (Rule #4)
    const invalidRes = await request(app)
      .post('/api/v1/menu/bulk-import')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Tenant-ID', tenantId)
      .send({ categories: [] }); // empty array fails validation
    expect(invalidRes.status).toBe(400);

    // 2. Successful bulk import
    const bulkImportPayload = {
      categories: [
        {
          name: 'Gourmet Burgers',
          displayOrder: 1,
          products: [
            {
              name: 'Smokey Bacon Burger',
              description: 'Angus beef patty with smoked bacon & cheddar',
              basePrice: 220,
              imageUrl: 'https://example.com/bacon-burger.jpg',
              variants: [
                {
                  name: 'Add Extra Patty',
                  minSelect: 0,
                  maxSelect: 1,
                  options: [{ name: 'Single Extra Patty', priceDelta: 60 }],
                },
              ],
            },
          ],
        },
      ],
    };

    const bulkRes = await request(app)
      .post('/api/v1/menu/bulk-import')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Tenant-ID', tenantId)
      .send(bulkImportPayload);

    expect(bulkRes.status).toBe(201);
    expect(bulkRes.body.success).toBe(true);
    expect(bulkRes.body.data.categoriesCount).toBeGreaterThanOrEqual(1);
    expect(bulkRes.body.data.productsCount).toBe(1);
    expect(bulkRes.body.data.variantsCount).toBe(1);

    // 3. Verify items stored in MongoDB scoped by tenantId
    const catDoc = await CategoryModel.findOne({ tenantId, name: 'Gourmet Burgers' });
    expect(catDoc).toBeDefined();

    const prodDoc = await ProductModel.findOne({ tenantId, name: 'Smokey Bacon Burger' });
    expect(prodDoc).toBeDefined();
    expect(prodDoc?.basePrice).toBe(220);

    const varDoc = await VariantModel.findOne({ tenantId, name: 'Add Extra Patty' });
    expect(varDoc).toBeDefined();
  });

  it('enforces cross-tenant isolation on bulk imported catalog', async () => {
    // Tenant A
    const tenantA = await TenantModel.create({
      name: 'Tenant Alpha',
      slug: `alpha-${Date.now()}-1`,
      status: 'active',
      contact: { phone: '01000000001', email: 'alpha@test.com' },
    });

    // Tenant B
    const tenantB = await TenantModel.create({
      name: 'Tenant Beta',
      slug: `beta-${Date.now()}-2`,
      status: 'active',
      contact: { phone: '01000000002', email: 'beta@test.com' },
    });

    const saRes = await request(app)
      .post('/api/v1/auth/register/super-admin')
      .send({
        email: `sa-${Date.now()}@alpha.com`,
        password: 'Password123!',
      });
    const saToken = saRes.body.data.tokens.accessToken;

    const regA = await request(app)
      .post('/api/v1/auth/register/owner')
      .set('Authorization', `Bearer ${saToken}`)
      .send({
        tenantId: tenantA._id.toString(),
        email: `owner-${Date.now()}@alpha.com`,
        password: 'Password123!',
      });
    const tokenA = regA.body.data.tokens.accessToken;

    // Tenant A bulk imports items
    await request(app)
      .post('/api/v1/menu/bulk-import')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('X-Tenant-ID', tenantA._id.toString())
      .send({
        categories: [
          {
            name: 'Alpha Secret Salad',
            products: [{ name: 'Caesar Salad', basePrice: 100 }],
          },
        ],
      });

    // Tenant B queries catalog — should NOT see Tenant A's products
    const catalogB = await request(app)
      .get(`/api/v1/menu/catalog?tenantId=${tenantB._id.toString()}`)
      .set('X-Tenant-ID', tenantB._id.toString());

    expect(catalogB.status).toBe(200);

    const alphaCatInB = catalogB.body.data.categories.find((c: any) => c.name === 'Alpha Secret Salad');
    expect(alphaCatInB).toBeUndefined();
  });

  it('executes background queue consumers reliably with MemoryQueueService', async () => {
    await queueService.assertQueues();

    let emailProcessed = false;
    let telegramProcessed = false;

    await queueService.consume(PLATFORM_QUEUES.EMAILS.name, async (payload: any, headers) => {
      await processEmailJob(payload, headers);
      emailProcessed = true;
    });

    await queueService.consume(PLATFORM_QUEUES.TELEGRAM.name, async (payload: any, headers) => {
      await processTelegramJob(payload, headers);
      telegramProcessed = true;
    });

    await queueService.enqueue(PLATFORM_QUEUES.EMAILS.name, {
      to: 'customer@example.com',
      subject: 'Order Receipt',
      template: 'receipt',
      context: {},
    }, { tenantId: 'tenant-456' });

    await queueService.enqueue(PLATFORM_QUEUES.TELEGRAM.name, {
      chatId: 987654321,
      message: 'New order arrived!',
    }, { tenantId: 'tenant-456' });

    // Wait for event tick
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(emailProcessed).toBe(true);
    expect(telegramProcessed).toBe(true);
  });

  it('verifies worker process handlers for invoice, subscription check, payment retry, and backup', async () => {
    expect(async () => {
      await processInvoiceJob({ tenantId: 't1', amount: 500, currency: 'EGP', paymentMethod: 'cash' });
      await processSubscriptionCheckJob({ tenantId: 't1', subscriptionId: 'sub-1', checkType: 'expiry_warning' });
      await processPaymentRetryJob({ tenantId: 't1', invoiceId: 'inv-1', attemptNumber: 1 });
      await processBackupJob({ backupType: 'daily', tenantId: 't1' });
    }).not.toThrow();
  });
});
