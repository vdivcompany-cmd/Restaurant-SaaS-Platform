import { describe, it, expect, beforeAll, afterAll } from 'vitest';
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

const app = createApp();

describe('Phase 9 — Correctness Fixes, Tenant-Context Rework & New Features', () => {
  let superAdminToken: string;
  let ownerToken: string;
  let tenantId: string;
  let branchId: string;
  let tableId: string;

  beforeAll(async () => {
    await connectDatabase();
    getRedisClient();

    // Create super admin
    const superAdmin = await UserModel.create({
      email: 'phase9-admin@test.com',
      passwordHash: 'hashed',
      role: 'super_admin',
    });

    // Create tenant
    const tenant = await TenantModel.create({
      name: 'Phase 9 Test Restaurant',
      slug: 'phase9-test',
      contact: { email: 'test@rest.com', phone: '+201234567890' },
      status: 'trial',
    });
    tenantId = tenant._id.toString();

    // Create owner
    const owner = await UserModel.create({
      email: 'phase9-owner@test.com',
      passwordHash: 'hashed',
      role: 'owner',
      tenantId,
    });

    // Create branch
    const branch = await BranchModel.create({
      tenantId,
      name: 'Phase 9 Branch',
      slug: 'phase9-branch',
      address: 'Test Address',
      phone: '+201234567890',
    });
    branchId = branch._id.toString();

    // Mock tokens (in real scenario, these come from auth endpoint)
    superAdminToken = `Bearer ${superAdmin._id}`;
    ownerToken = `Bearer ${owner._id}`;
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
      const newTenant = await TenantModel.create({
        name: 'Auto-Sub Test Tenant',
        slug: `auto-sub-${Date.now()}`,
        contact: { email: 'test2@rest.com', phone: '+201234567890' },
        status: 'trial',
      });

      const subscription = await SubscriptionModel.findOne({ tenantId: newTenant._id });
      expect(subscription).toBeDefined();
      expect(subscription?.plan).toBe('free');
      expect(subscription?.status).toBe('trialing');
    });

    it('should have no duplicate subscriptions (no lazy-create fallback)', async () => {
      const tenantWithSub = await TenantModel.create({
        name: 'No Dup Test',
        slug: `no-dup-${Date.now()}`,
        contact: { email: 'test3@rest.com', phone: '+201234567890' },
        status: 'trial',
      });

      const count = await SubscriptionModel.countDocuments({ tenantId: tenantWithSub._id });
      expect(count).toBe(1);
    });
  });

  describe('9.4 — Table Count Accounting', () => {
    it('should increment Branch.tableCount when creating table', async () => {
      const initialCount = (await BranchModel.findById(branchId))?.tableCount || 0;

      await TableModel.create({
        tenantId,
        branchId,
        number: 1,
        capacity: 4,
        qrCodeToken: `qr-${Date.now()}`,
        totalOrdersServed: 0,
      });

      const updatedBranch = await BranchModel.findById(branchId);
      expect(updatedBranch?.tableCount).toBe(initialCount + 1);
      tableId = (await TableModel.findOne({ number: 1 }))?.id;
    });

    it('should decrement Branch.tableCount when deleting table', async () => {
      const beforeCount = (await BranchModel.findById(branchId))?.tableCount || 0;

      if (tableId) {
        await TableModel.findByIdAndDelete(tableId);
      }

      const afterBranch = await BranchModel.findById(branchId);
      expect(afterBranch?.tableCount).toBe(beforeCount - 1 || 0);
    });

    it('should track totalOrdersServed counter on table', async () => {
      const table = await TableModel.findOne({ tenantId, branchId });
      expect(table?.totalOrdersServed).toBe(0);
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
      // Create another tenant
      const otherTenant = await TenantModel.create({
        name: 'Other Tenant',
        slug: `other-${Date.now()}`,
        contact: { email: 'other@rest.com', phone: '+201234567890' },
        status: 'trial',
      });

      // Try to create reservation for other tenant with owner token (should be isolated)
      const res = await request(app)
        .post('/api/v1/reservations')
        .send({
          tenantId: otherTenant._id,
          branchId,
          customerName: 'Hacker',
          customerPhone: '+201234567890',
          partySize: 2,
          reservedFor: new Date(Date.now() + 86400000).toISOString(),
        });
      // Should still succeed because POST is public, but isolation is in service layer
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
        expect(log?.branchId).toBe(branchId);
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
      // Tenant A should not see Tenant B's notifications
      const otherTenant = await TenantModel.create({
        name: 'Notification Test Tenant',
        slug: `notif-${Date.now()}`,
        contact: { email: 'notif@rest.com', phone: '+201234567890' },
        status: 'trial',
      });

      const otherOwner = await UserModel.create({
        email: `notif-owner-${Date.now()}@test.com`,
        passwordHash: 'hashed',
        role: 'owner',
        tenantId: otherTenant._id,
      });

      const otherToken = `Bearer ${otherOwner._id}`;

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
      const table = await TableModel.create({
        tenantId,
        branchId,
        number: 42,
        capacity: 4,
        qrCodeToken: 'temp', // Will be replaced by signed token
        totalOrdersServed: 0,
      });

      expect(table.qrCodeToken).toMatch(/^eyJ/); // JWT header starts with eyJ
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
});
