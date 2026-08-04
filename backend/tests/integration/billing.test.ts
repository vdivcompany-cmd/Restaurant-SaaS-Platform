import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { TenantModel } from '../../src/modules/tenants/model.js';
import { AuthService } from '../../src/modules/auth/service.js';

const app = createApp();

async function getSuperAdminToken(): Promise<string> {
  const ts = Date.now();
  const platformTenant = await TenantModel.create({
    name: 'Platform Operations',
    slug: `platform-billing-${ts}-${Math.random().toString(36).substring(7)}`,
    contact: { phone: '0000000', email: `platform_b_${ts}@admin.com` },
  });
  const admin = await AuthService.createSuperAdmin({
    tenantId: platformTenant._id.toString(),
    email: `admin_b_${ts}_${Math.random().toString(36).substring(7)}@platform.com`,
    password: 'superpassword123',
  });
  return admin.tokens.accessToken;
}

describe('Billing & Subscriptions Tenant Existence Guards', () => {
  it('should reject billing record creation for a non-existent tenantId with 404', async () => {
    const token = await getSuperAdminToken();
    const fakeTenantId = '507f1f77bcf86cd799439011';

    const res = await request(app)
      .post('/api/v1/billing')
      .set('Authorization', `Bearer ${token}`)
      .send({
        tenantId: fakeTenantId,
        amount: 49.99,
        currency: 'USD',
        status: 'paid',
        invoiceUrl: 'https://example.com/invoice.pdf',
        description: 'Monthly Subscription',
      });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('should reject subscription update for a non-existent tenantId with 404', async () => {
    const token = await getSuperAdminToken();
    const fakeTenantId = '507f1f77bcf86cd799439011';

    const res = await request(app)
      .patch('/api/v1/subscriptions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        tenantId: fakeTenantId,
        plan: 'pro',
        status: 'active',
      });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('should create a billing record for a real tenant successfully', async () => {
    const ts = Date.now();
    const token = await getSuperAdminToken();
    const realTenant = await TenantModel.create({
      name: 'Billing Test Tenant',
      slug: `billing-tenant-${ts}`,
      contact: { phone: '123456789', email: `billing-${ts}@test.com` },
    });

    const res = await request(app)
      .post('/api/v1/billing')
      .set('Authorization', `Bearer ${token}`)
      .send({
        tenantId: realTenant._id.toString(),
        amount: 99.99,
        currency: 'EGP',
        status: 'paid',
        invoiceUrl: 'https://example.com/inv.pdf',
        description: 'Pro Plan Monthly Renewal',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.amount).toBe(99.99);
  });
});
