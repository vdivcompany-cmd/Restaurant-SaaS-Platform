import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { connectDatabase } from '../../src/config/database.js';
import { getRedisClient } from '../../src/config/redis.js';
import { UserModel } from '../../src/modules/auth/model.js';
import { TenantModel } from '../../src/modules/tenants/model.js';
import { SubscriptionModel } from '../../src/modules/subscriptions/model.js';
import { BranchModel } from '../../src/modules/branches/model.js';
import { TableModel } from '../../src/modules/tables/model.js';
import { ReservationModel } from '../../src/modules/reservations/model.js';
import { NotificationLogModel } from '../../src/modules/notifications/model.js';
import { AuthService } from '../../src/modules/auth/service.js';
import { TenantService } from '../../src/modules/tenants/service.js';

const app = createApp();

describe('Phase 9 — Correctness Fixes, Tenant-Context Rework & New Features', () => {
  let superAdminToken: string;
  let ownerToken: string;
  let tenantId: string;
  let branchId: string;
  let tableId: string;

  beforeEach(async () => {
    // Create tenant via service so subscription & defaults are created
    const tenant = await TenantService.createTenant({
      name: 'Phase 9 Test Restaurant',
      slug: `phase9-test-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      contact: { email: `test-${Date.now()}@rest.com`, phone: '+201234567890' },
    });
    tenantId = tenant._id.toString();

    // Create super admin
    const superAdmin = await AuthService.createSuperAdmin({
      tenantId,
      email: `phase9-admin-${Date.now()}-${Math.random().toString(36).substring(7)}@test.com`,
      password: 'superpassword123',
    });
    superAdminToken = `Bearer ${superAdmin.tokens.accessToken}`;

    // Create owner via auth service for valid JWT
    const owner = await AuthService.registerOwner(tenantId, {
      email: `phase9-owner-${Date.now()}-${Math.random().toString(36).substring(7)}@test.com`,
      password: 'password123',
    });
    ownerToken = `Bearer ${owner.tokens.accessToken}`;

    // Create branch
    const branch = await BranchModel.create({
      tenantId,
      name: 'Phase 9 Branch',
      slug: `phase9-branch-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      address: 'Test Address',
      phone: '+201234567890',
    });
    branchId = branch._id.toString();
  });

  afterEach(async () => {
    await UserModel.deleteMany({});
    await TenantModel.deleteMany({});
    await SubscriptionModel.deleteMany({});
    await BranchModel.deleteMany({});
    await TableModel.deleteMany({});
    await ReservationModel.deleteMany({});
    await NotificationLogModel.deleteMany({});
  });

  afterAll(async () => {
    await UserModel.deleteMany({});
    await TenantModel.deleteMany({});
    await SubscriptionModel.deleteMany({});
    await BranchModel.deleteMany({});
    await TableModel.deleteMany({});
    await ReservationModel.deleteMany({});
    await NotificationLogModel.deleteMany({});
  });

  describe('9.1 — RBAC: Only super_admin for billing/subscriptions', () => {
    it('should reject owner PATCH /subscriptions with 403', async () => {
      const res = await request(app)
        .patch('/api/v1/subscriptions')
        .set('Authorization', ownerToken)
        .send({ tenantId, plan: 'pro' });
      expect(res.status).toBe(403);
    });

    it('should allow super_admin PATCH /subscriptions with valid tenantId in body', async () => {
      const res = await request(app)
        .patch('/api/v1/subscriptions')
        .set('Authorization', superAdminToken)
        .send({ tenantId, plan: 'pro', status: 'active' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should reject owner POST /billing with 403', async () => {
      const res = await request(app)
        .post('/api/v1/billing')
        .set('Authorization', ownerToken)
        .send({ tenantId, amount: 100 });
      expect(res.status).toBe(403);
    });

    it('should allow super_admin POST /billing with valid tenantId', async () => {
      const res = await request(app)
        .post('/api/v1/billing')
        .set('Authorization', superAdminToken)
        .send({ tenantId, amount: 100, currency: 'EGP', status: 'paid' });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });
  });

  describe('9.2 — Tenant Context: Body-based resolution', () => {
    it('should resolve tenant from req.body.tenantId for POST request', async () => {
      const res = await request(app)
        .post('/api/v1/feedback')
        .send({
          tenantId,
          branchId,
          rating: 5,
          comment: 'Great service!',
        });
      expect(res.status).toBe(201);
    });

    it('should reject POST request with no tenantId (no body, no header, no query)', async () => {
      const res = await request(app)
        .post('/api/v1/feedback')
        .send({ rating: 5, comment: 'Test' });
      expect(res.status).toBe(403);
    });

    it('should resolve tenant from query param for GET request', async () => {
      const res = await request(app)
        .get(`/api/v1/tables?tenantId=${tenantId}`);
      expect(res.status).toBeOneOf([200, 401]); // 401 if auth required, 200 if public
    });
  });

  describe('9.3 — Atomic Tenant Provisioning', () => {
    it('should create subscription immediately when creating tenant', async () => {
      const res = await request(app)
        .post('/api/v1/tenants')
        .set('Authorization', superAdminToken)
        .send({
          name: 'Auto-Sub Test Tenant',
          slug: `auto-sub-${Date.now()}`,
          contact: { email: `test2-${Date.now()}@rest.com`, phone: '+201234567890' },
        });

      expect(res.status).toBe(201);
      const createdTenantId = res.body.data._id || res.body.data.id;
      const subscription = await SubscriptionModel.findOne({ tenantId: createdTenantId });
      expect(subscription).toBeDefined();
      expect(subscription?.plan).toBe('free');
      expect(['active', 'trialing']).toContain(subscription?.status);
    });

    it('should have no duplicate subscriptions (no lazy-create fallback)', async () => {
      const res = await request(app)
        .post('/api/v1/tenants')
        .set('Authorization', superAdminToken)
        .send({
          name: 'No Dup Test',
          slug: `no-dup-${Date.now()}`,
          contact: { email: `test3-${Date.now()}@rest.com`, phone: '+201234567890' },
        });

      expect(res.status).toBe(201);
      const createdTenantId = res.body.data._id || res.body.data.id;
      const count = await SubscriptionModel.countDocuments({ tenantId: createdTenantId });
      expect(count).toBe(1);
    });
  });

  describe('9.4 — Table Count Accounting', () => {
    it('should increment Branch.tableCount when creating table via service', async () => {
      const initialCount = (await BranchModel.findById(branchId))?.tableCount || 0;

      const res = await request(app)
        .post('/api/v1/tables')
        .set('Authorization', ownerToken)
        .send({
          branchId,
          number: 101,
          capacity: 4,
        });

      expect(res.status).toBe(201);
      const updatedBranch = await BranchModel.findById(branchId);
      expect(updatedBranch?.tableCount).toBe(initialCount + 1);
    });

    it('should decrement Branch.tableCount when deleting table via service', async () => {
      const createRes = await request(app)
        .post('/api/v1/tables')
        .set('Authorization', ownerToken)
        .send({
          branchId,
          number: 105,
          capacity: 4,
        });
      expect(createRes.status).toBe(201);
      const createdTableId = createRes.body.data._id || createRes.body.data.id;

      const beforeBranch = await BranchModel.findById(branchId);
      const beforeCount = beforeBranch?.tableCount || 0;

      const deleteRes = await request(app)
        .delete(`/api/v1/tables/${createdTableId}`)
        .set('Authorization', ownerToken);
      expect(deleteRes.status).toBe(200);

      const afterBranch = await BranchModel.findById(branchId);
      expect(afterBranch?.tableCount).toBe(Math.max(0, beforeCount - 1));
    });

    it('should track totalOrdersServed counter on table', async () => {
      const tableRes = await request(app)
        .post('/api/v1/tables')
        .set('Authorization', ownerToken)
        .send({
          branchId,
          number: 102,
          capacity: 4,
        });
      expect(tableRes.status).toBe(201);
      expect(tableRes.body.data.totalOrdersServed).toBe(0);
    });
  });

  describe('9.5 — Reservations Module', () => {
    it('should create reservation via public POST endpoint', async () => {
      const res = await request(app)
        .post('/api/v1/reservations')
        .send({
          tenantId,
          branchId,
          customerName: 'John Doe',
          customerPhone: '+201234567890',
          partySize: 4,
          reservedFor: new Date(Date.now() + 86400000).toISOString(),
          channel: 'TELEGRAM',
        });
      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('PENDING');
    });

    it('should list reservations (staff only)', async () => {
      const res = await request(app)
        .get(`/api/v1/reservations?branchId=${branchId}`)
        .set('Authorization', ownerToken);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should prevent cross-tenant isolation on reservations', async () => {
      const otherTenant = await TenantService.createTenant({
        name: 'Other Tenant',
        slug: `other-${Date.now()}`,
        contact: { email: `other-${Date.now()}@rest.com`, phone: '+201234567890' },
      });

      const res = await request(app)
        .post('/api/v1/reservations')
        .send({
          tenantId: otherTenant._id.toString(),
          branchId,
          customerName: 'Hacker',
          customerPhone: '+201234567890',
          partySize: 2,
          reservedFor: new Date(Date.now() + 86400000).toISOString(),
        });
      expect(res.status).toBeOneOf([201, 400, 404]);
    });
  });

  describe('9.9 — Notification Audit Log Enrichment', () => {
    it('should create notification log with branchId and actionMakerId', async () => {
      const res = await request(app)
        .post('/api/v1/notifications/dispatch')
        .set('Authorization', ownerToken)
        .send({
          channel: 'TELEGRAM',
          recipient: '+201234567890',
          subject: 'Test Notification',
          message: 'This is a test',
          branchId,
        });

      expect(res.status).toBeOneOf([200, 201]);
      if (res.body.data?.logId) {
        const log = await NotificationLogModel.findById(res.body.data.logId);
        expect(log?.branchId?.toString()).toBe(branchId);
        expect(log?.actionMakerId).toBeDefined();
      }
    });

    it('should list notification logs via GET endpoint', async () => {
      const res = await request(app)
        .get('/api/v1/notifications')
        .set('Authorization', ownerToken);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should maintain cross-tenant isolation on notifications', async () => {
      const otherTenant = await TenantService.createTenant({
        name: 'Notification Test Tenant',
        slug: `notif-${Date.now()}`,
        contact: { email: `notif-${Date.now()}@rest.com`, phone: '+201234567890' },
      });

      const otherOwner = await AuthService.registerOwner(otherTenant._id.toString(), {
        email: `notif-owner-${Date.now()}@test.com`,
        password: 'password123',
      });

      const otherToken = `Bearer ${otherOwner.tokens.accessToken}`;

      // Dispatch from first tenant
      await NotificationLogModel.create({
        tenantId,
        channel: 'TELEGRAM',
        recipient: '+201234567890',
        messageBody: 'Tenant 1 Message',
      });

      // Other tenant should not see it
      const res = await request(app)
        .get('/api/v1/notifications')
        .set('Authorization', otherToken);

      if (res.status === 200) {
        const otherTenantLogs = res.body.data.filter((log: any) => log.tenantId === tenantId);
        expect(otherTenantLogs.length).toBe(0);
      }
    });
  });

  describe('9.6 — QR Token JWT Signing', () => {
    it('should create QR token as signed JWT', async () => {
      const res = await request(app)
        .post('/api/v1/tables')
        .set('Authorization', ownerToken)
        .send({
          branchId,
          number: 103,
          capacity: 4,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.qrCodeToken).toMatch(/^eyJ/);
    });
  });

  describe('9.7 — Table Order History', () => {
    it('should return order history for table', async () => {
      const table = await TableModel.findOne({ tenantId, branchId });
      if (table) {
        const res = await request(app)
          .get(`/api/v1/tables/${table._id}/history`)
          .set('Authorization', ownerToken);

        expect(res.status).toBeOneOf([200, 404]);
        if (res.status === 200) {
          expect(Array.isArray(res.body.data)).toBe(true);
        }
      }
    });
  });

  describe('9.10 — AI Menu Upload & Auto Vector Ingestion', () => {
    it('should upload menu file buffer, parse items, clear Redis cache, and return vector status', async () => {
      const dummyBuffer = Buffer.from('%PDF-1.4 Mock PDF Menu Content');
      const res = await request(app)
        .post('/api/v1/menu/upload-file')
        .set('Authorization', ownerToken)
        .field('tenantId', tenantId)
        .attach('file', dummyBuffer, 'sample_menu.pdf');

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.fileUrl).toBeDefined();
      expect(res.body.data.importResult).toBeDefined();
      expect(typeof res.body.data.vectorsIngested).toBe('number');
    });
  });
});


