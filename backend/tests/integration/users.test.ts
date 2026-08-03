import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TenantModel } from '../../src/modules/tenants/model.js';
import { TenantService } from '../../src/modules/tenants/service.js';
import { UserModel } from '../../src/modules/auth/model.js';
import { AuthService } from '../../src/modules/auth/service.js';
import { UserRepository } from '../../src/modules/auth/repository.js';
import { connectDatabase } from '../../src/config/database.js';

describe('Users & Cross-Tenant User Isolation', () => {
  beforeAll(async () => {
    await connectDatabase();
  });

  afterAll(async () => {
    await UserModel.deleteMany({});
    await TenantModel.deleteMany({});
  });

  it('should isolate users by tenantId — User of Tenant A cannot be queried within Tenant B scope', async () => {
    const ts = Date.now();

    // 1. Create Tenant A & Tenant B
    const tenantA = await TenantService.createTenant({
      name: 'Restaurant Alpha',
      slug: `restaurant-alpha-${ts}`,
      contact: { phone: '1111111111', email: `owner-alpha-${ts}@alpha.com` },
    });

    const tenantB = await TenantService.createTenant({
      name: 'Restaurant Beta',
      slug: `restaurant-beta-${ts}`,
      contact: { phone: '2222222222', email: `owner-beta-${ts}@beta.com` },
    });

    const emailA = `user.alpha-${ts}@alpha.com`;
    const emailB = `user.beta-${ts}@beta.com`;

    // 2. Register User A under Tenant A & User B under Tenant B
    const userA = await AuthService.registerOwner(tenantA._id.toString(), {
      email: emailA,
      password: 'password123',
    });

    const userB = await AuthService.registerOwner(tenantB._id.toString(), {
      email: emailB,
      password: 'password123',
    });

    // 3. Attempt to find User B using Tenant A's tenantId scope
    const foundBInTenantA = await UserRepository.findByEmail(
      tenantA._id.toString(),
      emailB
    );
    expect(foundBInTenantA).toBeNull();

    // 4. Attempt to find User B by ID using Tenant A's tenantId scope
    const foundByIdInTenantA = await UserRepository.findById(
      tenantA._id.toString(),
      userB.user.id
    );
    expect(foundByIdInTenantA).toBeNull();

    // 5. Attempt to find User A using Tenant B's tenantId scope
    const foundAInTenantB = await UserRepository.findByEmail(
      tenantB._id.toString(),
      emailA
    );
    expect(foundAInTenantB).toBeNull();

    // 6. Verify User A is strictly found within Tenant A's scope
    const validFoundA = await UserRepository.findByEmail(
      tenantA._id.toString(),
      emailA
    );
    expect(validFoundA).toBeDefined();
    expect(validFoundA?._id.toString()).toBe(userA.user.id);
  });
});
