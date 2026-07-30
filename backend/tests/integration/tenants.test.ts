import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { TenantModel } from '../../src/modules/tenants/model.js';
import { AuthService } from '../../src/modules/auth/service.js';

const app = createApp();

describe('Tenants API & Cross-Tenant Isolation', () => {
  it('should create a new tenant successfully', async () => {
    const res = await request(app)
      .post('/api/v1/tenants')
      .send({
        name: 'Burger House',
        slug: 'burger-house',
        contact: {
          phone: '+201001234567',
          email: 'info@burgerhouse.com',
        },
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.slug).toBe('burger-house');
    expect(res.body.data.status).toBe('trial');
  });

  it('should reject duplicate tenant slug', async () => {
    await TenantModel.create({
      name: 'Pizza Place',
      slug: 'pizza-place',
      contact: { phone: '123456', email: 'p@pizza.com' },
    });

    const res = await request(app)
      .post('/api/v1/tenants')
      .send({
        name: 'Pizza Place Duplicate',
        slug: 'pizza-place',
        contact: { phone: '654321', email: 'p2@pizza.com' },
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('CROSS-TENANT ISOLATION: User of Tenant A cannot read or modify Tenant B data', async () => {
    // 1. Create Tenant A & Tenant B
    const tenantA = await TenantModel.create({
      name: 'Restaurant A',
      slug: 'restaurant-a',
      contact: { phone: '111111', email: 'owner@a.com' },
    });

    const tenantB = await TenantModel.create({
      name: 'Restaurant B',
      slug: 'restaurant-b',
      contact: { phone: '222222', email: 'owner@b.com' },
    });

    // 2. Register Owner for Tenant A & Owner for Tenant B
    const userA = await AuthService.register({
      tenantId: tenantA._id.toString(),
      email: 'owner@a.com',
      password: 'password123',
      role: 'owner',
    });

    // 3. User A attempts to access Tenant B endpoint using User A's token
    const getTenantBRes = await request(app)
      .get(`/api/v1/tenants/${tenantB._id.toString()}`)
      .set('Authorization', `Bearer ${userA.tokens.accessToken}`)
      .set('X-Tenant-Id', tenantB._id.toString());

    // Should be rejected by RBAC/tenant isolation check
    expect(getTenantBRes.status).toBe(403);
    expect(getTenantBRes.body.success).toBe(false);

    // 4. User A attempts to update Tenant B settings
    const updateTenantBRes = await request(app)
      .patch(`/api/v1/tenants/${tenantB._id.toString()}/settings`)
      .set('Authorization', `Bearer ${userA.tokens.accessToken}`)
      .set('X-Tenant-Id', tenantB._id.toString())
      .send({ name: 'Hacked Restaurant B' });

    expect(updateTenantBRes.status).toBe(403);
    expect(updateTenantBRes.body.success).toBe(false);

    // Assert Tenant B data was unchanged
    const unchangedB = await TenantModel.findById(tenantB._id);
    expect(unchangedB?.name).toBe('Restaurant B');
  });
});
