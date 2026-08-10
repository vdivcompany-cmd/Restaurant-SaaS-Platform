import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../../src/app.js';
import { MenuRepository } from '../../src/modules/menu/repository.js';
import { MenuModel } from '../../src/modules/menu/model.js';
import { TableService } from '../../src/modules/tables/service.js';
import { TableModel } from '../../src/modules/tables/model.js';
import { OrderModel } from '../../src/modules/orders/model.js';
import { TenantModel } from '../../src/modules/tenants/model.js';
import { buildProductMetadata } from '../../src/modules/vector/embedding.service.js';

const app = createApp();

describe('Phase 11 — Secure, Server-Priced, AI-Orderable QR Ordering Integration Suite', () => {
  const menuRepo = new MenuRepository();
  const tableService = new TableService();

  let tenantIdA: string;
  let tenantIdB: string;
  let branchIdA: string;
  let branchIdB: string;
  let tableIdA: string;
  let tableSessionIdA: string;
  let productAId: string;
  let productBId: string;
  let productWithVariantId: string;
  let variantId: string;

  beforeAll(async () => {
    tenantIdA = new mongoose.Types.ObjectId().toString();
    tenantIdB = new mongoose.Types.ObjectId().toString();
    branchIdA = new mongoose.Types.ObjectId().toString();
    branchIdB = new mongoose.Types.ObjectId().toString();

    // Create dummy Tenant A & B in database so tenantMiddleware passes
    await TenantModel.create([
      {
        _id: tenantIdA,
        name: 'Tenant A',
        slug: `tenant-a-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        status: 'active',
        contact: { email: 'tenant-a@test.com', phone: '+201000000001' },
      },
      {
        _id: tenantIdB,
        name: 'Tenant B',
        slug: `tenant-b-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        status: 'active',
        contact: { email: 'tenant-b@test.com', phone: '+201000000002' },
      },
    ]);

    // Seed product A without variants (basePrice: 50)
    const prodA = await menuRepo.addOrUpdateProduct(tenantIdA, {
      name: 'Burger Deluxe',
      basePrice: 50,
      isAvailable: true,
    });
    productAId = prodA._id.toString();

    // Seed product B for Tenant B (basePrice: 60)
    const prodB = await menuRepo.addOrUpdateProduct(tenantIdB, {
      name: 'Pasta Carbonara',
      basePrice: 60,
      isAvailable: true,
    });
    productBId = prodB._id.toString();

    // Seed product with variants (basePrice: 100, variant with option priceDelta: 20)
    const prodVariant = await menuRepo.addOrUpdateProduct(tenantIdA, {
      name: 'Custom Pizza',
      basePrice: 100,
      isAvailable: true,
      variants: [
        {
          _id: new mongoose.Types.ObjectId(),
          name: 'Crust Type',
          minSelect: 1,
          maxSelect: 1,
          options: [
            { name: 'Stuffed Crust', price: 20, additionalPrice: 20 },
            { name: 'Thin Crust', price: 0, additionalPrice: 0 },
          ],
        } as any,
      ],
    });
    productWithVariantId = prodVariant._id.toString();
    variantId = prodVariant.variants[0]._id.toString();

    // Create table & active table session for Tenant A
    const tableA = await tableService.createTable(tenantIdA, {
      branchId: branchIdA,
      number: 10,
      capacity: 4,
    });
    tableIdA = tableA._id.toString();
    const resolved = await tableService.resolveByQrToken(tableA.qrCodeToken);
    tableSessionIdA = resolved.sessionId;
  }, 30000);

  afterAll(async () => {
    await TenantModel.deleteMany({ _id: { $in: [tenantIdA, tenantIdB] } });
    await MenuModel.deleteMany({ tenantId: { $in: [tenantIdA, tenantIdB] } });
    await TableModel.deleteMany({ tenantId: { $in: [tenantIdA, tenantIdB] } });
    await OrderModel.deleteMany({ tenantId: { $in: [tenantIdA, tenantIdB] } });
  }, 30000);

  it('1. POST /api/v1/orders/qr with valid minimal payload succeeds and calculates prices server-side', async () => {
    const res = await request(app)
      .post('/api/v1/orders/qr')
      .send({
        tenantId: tenantIdA,
        branchId: branchIdA,
        tableId: tableIdA,
        tableSessionId: tableSessionIdA,
        items: [
          { productId: productAId, quantity: 2 },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.channel).toBe('DINE_IN');
    expect(res.body.data.subtotal).toBe(100); // 50 * 2
    expect(res.body.data.totalAmount).toBe(100);
    expect(res.body.data.items[0].unitPrice).toBe(50);
    expect(res.body.data.items[0].totalPrice).toBe(100);
  });

  it('2. POST /api/v1/orders/qr fails (400) when client injects unitPrice/totalPrice fields (.strict() enforcement)', async () => {
    const res = await request(app)
      .post('/api/v1/orders/qr')
      .send({
        tenantId: tenantIdA,
        branchId: branchIdA,
        tableId: tableIdA,
        tableSessionId: tableSessionIdA,
        items: [
          { productId: productAId, quantity: 2, unitPrice: 0.01, totalPrice: 0.02 },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Validation failed');
  });

  it('3. POST /api/v1/orders/qr calculated variant price delta correctly', async () => {
    const res = await request(app)
      .post('/api/v1/orders/qr')
      .send({
        tenantId: tenantIdA,
        branchId: branchIdA,
        tableId: tableIdA,
        tableSessionId: tableSessionIdA,
        items: [
          {
            productId: productWithVariantId,
            quantity: 1,
            variantId: variantId,
            selectedOptionNames: ['Stuffed Crust'],
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    // Base 100 + 20 option delta = 120
    expect(res.body.data.items[0].unitPrice).toBe(120);
    expect(res.body.data.items[0].totalPrice).toBe(120);
    expect(res.body.data.totalAmount).toBe(120);
  });

  it('4. POST /api/v1/orders/qr fails (404) for non-existent productId', async () => {
    const fakeProdId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .post('/api/v1/orders/qr')
      .send({
        tenantId: tenantIdA,
        branchId: branchIdA,
        tableId: tableIdA,
        tableSessionId: tableSessionIdA,
        items: [
          { productId: fakeProdId, quantity: 1 },
        ],
      });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('5. POST /api/v1/orders/qr fails (400) when client injects non-DINE_IN channel field', async () => {
    const res = await request(app)
      .post('/api/v1/orders/qr')
      .send({
        tenantId: tenantIdA,
        branchId: branchIdA,
        tableId: tableIdA,
        tableSessionId: tableSessionIdA,
        channel: 'TAKEAWAY',
        items: [
          { productId: productAId, quantity: 1 },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('6. POST /api/v1/orders/qr with valid session from Tenant A targeting Tenant B fails (403)', async () => {
    const res = await request(app)
      .post('/api/v1/orders/qr')
      .send({
        tenantId: tenantIdB,
        branchId: branchIdB,
        tableId: tableIdA,
        tableSessionId: tableSessionIdA,
        items: [
          { productId: productBId, quantity: 1 },
        ],
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('7. POST /api/v1/orders/qr with invalid or expired tableSessionId fails (403)', async () => {
    const res = await request(app)
      .post('/api/v1/orders/qr')
      .send({
        tenantId: tenantIdA,
        branchId: branchIdA,
        tableId: tableIdA,
        tableSessionId: '00000000-0000-0000-0000-000000000000',
        items: [
          { productId: productAId, quantity: 1 },
        ],
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('8. buildProductMetadata includes enriched variants metadata for vector search', async () => {
    const prod = await menuRepo.findProductById(tenantIdA, productWithVariantId);
    expect(prod).not.toBeNull();

    const metadata = buildProductMetadata(tenantIdA, prod!);
    expect(metadata['productId']).toBe(productWithVariantId);
    expect(metadata['basePrice']).toBe(100);
    expect(Array.isArray(metadata['variants'])).toBe(true);
    
    const variants = metadata['variants'] as any[];
    expect(variants.length).toBe(1);
    expect(variants[0].name).toBe('Crust Type');
    expect(variants[0].options[0]).toEqual({
      name: 'Stuffed Crust',
      priceDelta: 20,
    });
  });
});
