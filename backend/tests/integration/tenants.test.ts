import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { TenantModel } from '../../src/modules/tenants/model.js';
import { BranchModel } from '../../src/modules/branches/model.js';
import { AuthService } from '../../src/modules/auth/service.js';

const app = createApp();

async function getSuperAdminToken(): Promise<string> {
  const ts = Date.now();
  const platformTenant = await TenantModel.create({
    name: 'Platform Operations',
    slug: `platform-${ts}-${Math.random().toString(36).substring(7)}`,
    contact: { phone: '0000000', email: `platform_${ts}@admin.com` },
  });
  const admin = await AuthService.createSuperAdmin({
    tenantId: platformTenant._id.toString(),
    email: `admin_${ts}_${Math.random().toString(36).substring(7)}@platform.com`,
    password: 'superpassword123',
  });
  return admin.tokens.accessToken;
}

describe('Tenants API, Super Admin RBAC & Cross-Tenant Isolation', () => {
  it('should reject unauthenticated or non-super_admin attempts to create a tenant', async () => {
    const ts = Date.now();
    // 1. Unauthenticated attempt
    const unauthRes = await request(app)
      .post('/api/v1/tenants')
      .send({
        name: 'Hacked Place',
        slug: `hacked-place-${ts}`,
      });
    expect(unauthRes.status).toBe(401);

    // 2. Normal restaurant owner attempt
    const tempTenant = await TenantModel.create({ name: 'Temp', slug: `temp-${ts}`, contact: { phone: '1', email: `t-${ts}@t.com` } });
    const normalOwner = await AuthService.registerOwner(tempTenant._id.toString(), {
      email: `owner-normal-${ts}@normal.com`,
      password: 'password123',
    });

    const ownerRes = await request(app)
      .post('/api/v1/tenants')
      .set('Authorization', `Bearer ${normalOwner.tokens.accessToken}`)
      .send({
        name: 'Unauthorized Place',
        slug: `unauthorized-place-${ts}`,
      });
    expect(ownerRes.status).toBe(403);
  });

  it('should create a new tenant successfully when called by super_admin', async () => {
    const ts = Date.now();
    const token = await getSuperAdminToken();
    const res = await request(app)
      .post('/api/v1/tenants')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Burger House',
        slug: `burger-house-${ts}`,
        contact: {
          phone: '+201001234567',
          email: `info-${ts}@burgerhouse.com`,
        },
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.slug).toBe(`burger-house-${ts}`);
    expect(res.body.data.status).toBe('trial');
  });

  it('should reject duplicate tenant slug when created by super_admin', async () => {
    const ts = Date.now();
    const token = await getSuperAdminToken();
    const dupSlug = `pizza-place-dup-${ts}`;

    await TenantModel.create({
      name: 'Pizza Place',
      slug: dupSlug,
      contact: { phone: '123456', email: `p-${ts}@pizza.com` },
    });

    const res = await request(app)
      .post('/api/v1/tenants')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Pizza Place Duplicate',
        slug: dupSlug,
        contact: { phone: '654321', email: `p2-${ts}@pizza.com` },
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('CROSS-TENANT ISOLATION: User of Tenant A cannot read or modify Tenant B data', async () => {
    const ts = Date.now();

    // 1. Create Tenant A & Tenant B
    const tenantA = await TenantModel.create({
      name: 'Restaurant A',
      slug: `restaurant-a-${ts}`,
      contact: { phone: '111111', email: `owner-a-${ts}@a.com` },
    });

    const tenantB = await TenantModel.create({
      name: 'Restaurant B',
      slug: `restaurant-b-${ts}`,
      contact: { phone: '222222', email: `owner-b-${ts}@b.com` },
    });

    // 2. Register Owner for Tenant A & Owner for Tenant B
    const userA = await AuthService.registerOwner(tenantA._id.toString(), {
      email: `owner-a-${ts}@a.com`,
      password: 'password123',
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

  it('SUPER ADMIN EXCEPTION: super_admin can inspect tenant details via X-Target-Tenant-Id without being blocked by cross-tenant checks', async () => {
    const ts = Date.now();
    const token = await getSuperAdminToken();
    const targetTenant = await TenantModel.create({
      name: 'Client Restaurant',
      slug: `client-restaurant-${ts}`,
      contact: { phone: '999999', email: `client-${ts}@rest.com` },
    });

    const res = await request(app)
      .get(`/api/v1/tenants/${targetTenant._id.toString()}`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Target-Tenant-Id', targetTenant._id.toString());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Client Restaurant');
  });

  it('should reject super_admin impersonation attempts targeting a nonexistent tenantId or tenantSlug with 404', async () => {
    const token = await getSuperAdminToken();
    const fakeTenantId = '507f1f77bcf86cd799439011';

    const resId = await request(app)
      .get(`/api/v1/tenants/${fakeTenantId}`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Target-Tenant-Id', fakeTenantId);

    expect(resId.status).toBe(404);
    expect(resId.body.success).toBe(false);
    expect(resId.body.message).toBe('Target tenant not found');

    const resSlug = await request(app)
      .get('/api/v1/subscriptions')
      .set('Authorization', `Bearer ${token}`)
      .query({ tenantSlug: 'nonexistent-tenant-slug-xyz' });

    expect(resSlug.status).toBe(404);
    expect(resSlug.body.success).toBe(false);
    expect(resSlug.body.message).toBe('Target tenant not found');
  });

  it('PUBLIC ROUTE: allows unauthenticated retrieval of tenant & branch small info by tenantId and branchId', async () => {
    const ts = Date.now();
    const tenant = await TenantModel.create({
      name: 'Public Info Cafe',
      slug: `public-cafe-${ts}`,
      contact: { phone: '12345678', email: `info-${ts}@publiccafe.com` },
      brandName: 'Public Cafe',
      cuisineType: 'Beverages',
      description: 'Cozy coffee shop',
    });

    const branch = await BranchModel.create({
      tenantId: tenant._id,
      name: 'Downtown Branch',
      slug: `downtown-${ts}`,
      address: '123 Main Street',
      phone: '12345678',
      isActive: true,
    });

    const res = await request(app)
      .get(`/api/v1/tenants/${tenant._id.toString()}/branches/${branch._id.toString()}/info`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.tenant.name).toBe('Public Info Cafe');
    expect(res.body.data.tenant.brandName).toBe('Public Cafe');
    expect(res.body.data.tenant.cuisineType).toBe('Beverages');
    expect(res.body.data.branch.name).toBe('Downtown Branch');
    expect(res.body.data.branch.address).toBe('123 Main Street');
  });
});

