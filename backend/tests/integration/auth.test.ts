import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { TenantModel } from '../../src/modules/tenants/model.js';

const app = createApp();

describe('Auth API (Register, Login, Refresh, Logout, Revocation)', () => {
  it('should register a new user in a tenant', async () => {
    const tenant = await TenantModel.create({
      name: 'Auth Test Restaurant',
      slug: 'auth-test',
      contact: { phone: '123456', email: 'test@auth.com' },
    });

    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        tenantId: tenant._id.toString(),
        email: 'manager@auth.com',
        password: 'password123',
        role: 'manager',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe('manager@auth.com');
    expect(res.body.data.user.role).toBe('manager');
    expect(res.body.data.tokens.accessToken).toBeDefined();
    expect(res.body.data.tokens.refreshToken).toBeDefined();
  });

  it('should fail validation on weak password or invalid email', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        tenantId: '507f1f77bcf86cd799439011',
        email: 'not-an-email',
        password: 'short',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.errors).toBeDefined();
  });

  it('should login user and return new tokens', async () => {
    const tenant = await TenantModel.create({
      name: 'Login Test Restaurant',
      slug: 'login-test',
      contact: { phone: '123456', email: 'test@login.com' },
    });

    await request(app)
      .post('/api/v1/auth/register')
      .send({
        tenantId: tenant._id.toString(),
        email: 'staff@login.com',
        password: 'securepassword123',
        role: 'cashier',
      });

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        tenantSlug: 'login-test',
        email: 'staff@login.com',
        password: 'securepassword123',
      });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.success).toBe(true);
    expect(loginRes.body.data.tokens.accessToken).toBeDefined();
  });

  it('should handle token refresh rotation, logout, and IMMEDIATELY revoke access token', async () => {
    const tenant = await TenantModel.create({
      name: 'Refresh Test Restaurant',
      slug: 'refresh-test',
      contact: { phone: '123456', email: 'test@refresh.com' },
    });

    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        tenantId: tenant._id.toString(),
        email: 'user@refresh.com',
        password: 'password123',
        role: 'owner',
      });

    const { refreshToken } = regRes.body.data.tokens;

    // Refresh token
    const refreshRes = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken });

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.success).toBe(true);
    const newAccessToken = refreshRes.body.data.tokens.accessToken;
    expect(newAccessToken).toBeDefined();

    // Verify access token works before logout
    const getTenantBeforeLogout = await request(app)
      .get('/api/v1/tenants/me')
      .set('Authorization', `Bearer ${newAccessToken}`);

    expect(getTenantBeforeLogout.status).toBe(200);

    // Logout
    const logoutRes = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${newAccessToken}`);

    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body.success).toBe(true);

    // Attempting to refresh with old refresh token after logout should fail
    const postLogoutRefresh = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken });

    expect(postLogoutRefresh.status).toBe(401);

    // Attempting to use the logged-out access token MUST be rejected (401 Revoked)
    const getTenantAfterLogout = await request(app)
      .get('/api/v1/tenants/me')
      .set('Authorization', `Bearer ${newAccessToken}`);

    expect(getTenantAfterLogout.status).toBe(401);
    expect(getTenantAfterLogout.body.message).toContain('revoked');
  });
});
