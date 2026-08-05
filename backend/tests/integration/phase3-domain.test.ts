import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { TenantModel } from '../../src/modules/tenants/model.js';
import { TenantService } from '../../src/modules/tenants/service.js';

const app = createApp();

describe('Phase 3 Domain Modules Integration Suite', () => {
  it('should execute complete Phase 3 operational user journey across all 12 domain modules', async () => {
    // 0. Setup Tenant & Owner Account
    const tenant = await TenantService.createTenant({
      name: 'Phase 3 Gourmet SaaS',
      slug: `gourmet-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      contact: { phone: '0123456789', email: `owner-${Date.now()}@gourmet.com` },
    });
    const tenantId = tenant._id.toString();

    const saRes = await request(app)
      .post('/api/v1/auth/register/super-admin')
      .send({
        email: `sa-${Date.now()}@gourmet.com`,
        password: 'SuperSecurePassword123!',
      });
    const saToken = saRes.body.data.tokens.accessToken;

    const regRes = await request(app)
      .post('/api/v1/auth/register/owner')
      .set('Authorization', `Bearer ${saToken}`)
      .send({
        tenantId,
        email: `owner-${Date.now()}@gourmet.com`,
        password: 'SuperSecurePassword123!',
      });
    expect(regRes.status).toBe(201);
    const accessToken = regRes.body.data.tokens.accessToken;

    // 1. Branches & Restaurant Brand Profile Configuration
    const branchRes = await request(app)
      .post('/api/v1/branches')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Downtown Main Branch',
        slug: 'downtown-main',
        address: '123 Boulevard, Downtown',
        phone: '+20112345678',
        isActive: true,
      });
    expect(branchRes.status).toBe(201);
    const branchId = branchRes.body.data._id;
    expect(branchRes.body.data.name).toBe('Downtown Main Branch');

    const profileRes = await request(app)
      .put('/api/v1/tenants/profile')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        brandName: 'Gourmet Express',
        cuisineType: 'Italian & Fusion',
        currency: 'EGP',
        description: 'Authentic stone-oven dining experience',
      });
    expect(profileRes.status).toBe(200);
    expect(profileRes.body.data.brandName).toBe('Gourmet Express');
    expect(profileRes.body.data.currency).toBe('EGP');

    // 2. Digital Menu Catalog (Categories, Variants, Products & Caching)
    const catRes = await request(app)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Artisan Pizzas',
        description: 'Hand-stretched wood-fired pizzas',
        displayOrder: 1,
      });
    expect(catRes.status).toBe(201);
    const categoryId = catRes.body.data._id;

    const varRes = await request(app)
      .post('/api/v1/variants')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Crust Selection',
        minSelect: 1,
        maxSelect: 1,
        options: [
          { name: 'Classic Neapolitan', priceDelta: 0 },
          { name: 'Cheese Stuffed Crust', priceDelta: 35 },
        ],
      });
    expect(varRes.status).toBe(201);
    const variantId = varRes.body.data._id;

    const prodRes = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        categoryId,
        name: 'Truffle Mushroom Pizza',
        description: 'Wild mushrooms, mozzarella, truffle oil spray',
        basePrice: 280,
        variantIds: [variantId],
      });
    expect(prodRes.status).toBe(201);
    const productId = prodRes.body.data._id;

    const menuRes = await request(app)
      .get(`/api/v1/menu/catalog?tenantId=${tenantId}`);
    expect(menuRes.status).toBe(200);
    expect(menuRes.body.data.categories.length).toBeGreaterThanOrEqual(1);
    const pizzaCat = menuRes.body.data.categories.find((c: any) => c.id === categoryId);
    expect(pizzaCat).toBeDefined();
    expect(pizzaCat.products[0].name).toBe('Truffle Mushroom Pizza');
    expect(pizzaCat.products[0].variantIds[0].name).toBe('Crust Selection');

    // 3. Dining Floor Tables & QR Token Resolution
    const tableRes = await request(app)
      .post('/api/v1/tables')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        branchId,
        number: 10,
        capacity: 4,
        status: 'AVAILABLE',
      });
    expect(tableRes.status).toBe(201);
    const tableId = tableRes.body.data._id;
    const qrCodeToken = tableRes.body.data.qrCodeToken;
    expect(qrCodeToken).toMatch(/^eyJ/);

    const resolveRes = await request(app).get(`/api/v1/tables/qr/${qrCodeToken}`);
    expect(resolveRes.status).toBe(200);
    expect(resolveRes.body.data.number).toBe(10);
    expect(resolveRes.body.data.status).toBe('AVAILABLE');

    // 4. Orders, Automated Table State Machine & POS Offline Sync Deduplication
    const orderRes = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        branchId,
        channel: 'DINE_IN',
        tableId,
        items: [
          {
            productId,
            name: 'Truffle Mushroom Pizza',
            quantity: 2,
            unitPrice: 280,
            totalPrice: 560,
          },
        ],
        subtotal: 560,
        taxAmount: 0,
        totalAmount: 560,
      });
    expect(orderRes.status).toBe(201);
    const firstOrderId = orderRes.body.data._id;
    expect(orderRes.body.data.orderNumber).toMatch(/^ORD-/);

    const tableCheck1 = await request(app)
      .get(`/api/v1/tables/${tableId}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(tableCheck1.status).toBe(200);
    expect(tableCheck1.body.data.status).toBe('OCCUPIED');
    expect(tableCheck1.body.data.currentOrderId).toBe(firstOrderId);

    const patchRes = await request(app)
      .patch(`/api/v1/orders/${firstOrderId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ status: 'PAID' });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.status).toBe('PAID');

    const tableCheck2 = await request(app)
      .get(`/api/v1/tables/${tableId}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(tableCheck2.body.data.status).toBe('AVAILABLE');
    expect(tableCheck2.body.data.currentOrderId).toBeNull();

    const offlineRes1 = await request(app)
      .post('/api/v1/orders/offline-sync')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        branchId,
        orders: [
          {
            branchId,
            channel: 'TAKEAWAY',
            items: [{ productId, name: 'Pizza', quantity: 1, unitPrice: 280, totalPrice: 280 }],
            subtotal: 280,
            totalAmount: 280,
            offlineGuid: 'guid-pos-001',
          },
          {
            branchId,
            channel: 'TAKEAWAY',
            items: [{ productId, name: 'Pizza', quantity: 2, unitPrice: 280, totalPrice: 560 }],
            subtotal: 560,
            totalAmount: 560,
            offlineGuid: 'guid-pos-002',
          },
        ],
      });
    expect(offlineRes1.status).toBe(200);
    expect(offlineRes1.body.data.synced).toBe(2);
    expect(offlineRes1.body.data.skipped).toBe(0);

    const offlineRes2 = await request(app)
      .post('/api/v1/orders/offline-sync')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        branchId,
        orders: [
          {
            branchId,
            channel: 'TAKEAWAY',
            items: [{ productId, name: 'Pizza', quantity: 1, unitPrice: 280, totalPrice: 280 }],
            subtotal: 280,
            totalAmount: 280,
            offlineGuid: 'guid-pos-001',
          },
          {
            branchId,
            channel: 'TAKEAWAY',
            items: [{ productId, name: 'Pizza', quantity: 1, unitPrice: 280, totalPrice: 280 }],
            subtotal: 280,
            totalAmount: 280,
            offlineGuid: 'guid-pos-003',
          },
        ],
      });
    expect(offlineRes2.status).toBe(200);
    expect(offlineRes2.body.data.synced).toBe(1);
    expect(offlineRes2.body.data.skipped).toBe(1);

    // 5. Coupons, Customers, Employees, Feedback & Real-time Sales Reporting
    const couponRes = await request(app)
      .post('/api/v1/coupons')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        code: 'WELCOME15',
        discountPercentage: 15,
        expiresAt: new Date(Date.now() + 86400 * 30 * 1000).toISOString(),
        isActive: true,
      });
    expect(couponRes.status).toBe(201);

    const validateRes = await request(app)
      .get(`/api/v1/coupons/validate?code=welcome15`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(validateRes.status).toBe(200);
    expect(validateRes.body.data.valid).toBe(true);
    expect(validateRes.body.data.discountPercentage).toBe(15);

    const custRes = await request(app)
      .post('/api/v1/customers')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Tariq Al-Mansour',
        phone: '01099887766',
        email: 'tariq@example.com',
      });
    expect(custRes.status).toBe(201);

    const empRes = await request(app)
      .post('/api/v1/employees')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        branchId,
        fullName: 'Chef Marco Rossi',
        position: 'Head Pizzaiolo',
        phone: '01122334455',
        hourlyRate: 150,
      });
    expect(empRes.status).toBe(201);

    const fbRes = await request(app)
      .post('/api/v1/feedback')
      .set('X-Tenant-ID', tenantId)
      .send({
        tenantId,
        branchId,
        customerName: 'Tariq Al-Mansour',
        rating: 5,
        comment: 'Best truffle pizza in town! Exceptional service and quick delivery.',
      });
    expect(fbRes.status).toBe(201);

    const reportRes = await request(app)
      .get('/api/v1/reports/sales')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(reportRes.status).toBe(200);
    expect(reportRes.body.data.totalOrders).toBe(4);
    expect(reportRes.body.data.paidOrders).toBe(1);
    expect(reportRes.body.data.totalRevenue).toBe(560);
  });
});
