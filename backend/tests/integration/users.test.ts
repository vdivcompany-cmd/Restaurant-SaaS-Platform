import { describe, it, expect } from 'vitest';
import { TenantModel } from '../../src/modules/tenants/model.js';
import { AuthService } from '../../src/modules/auth/service.js';
import { UserRepository } from '../../src/modules/auth/repository.js';

describe('Users & Cross-Tenant User Isolation', () => {
  it('should isolate users by tenantId — User of Tenant A cannot be queried within Tenant B scope', async () => {
    // 1. Create Tenant A & Tenant B
    const tenantA = await TenantModel.create({
      name: 'Restaurant Alpha',
      slug: 'restaurant-alpha',
      contact: { phone: '1111111111', email: 'owner@alpha.com' },
    });

    const tenantB = await TenantModel.create({
      name: 'Restaurant Beta',
      slug: 'restaurant-beta',
      contact: { phone: '2222222222', email: 'owner@beta.com' },
    });

    // 2. Register User A under Tenant A & User B under Tenant B
    const userA = await AuthService.registerOwner(tenantA._id.toString(), {
      email: 'user.alpha@alpha.com',
      password: 'password123',
    });

    const userB = await AuthService.registerOwner(tenantB._id.toString(), {
      email: 'user.beta@beta.com',
      password: 'password123',
    });

    // 3. Attempt to find User B using Tenant A's tenantId scope
    const foundBInTenantA = await UserRepository.findByEmail(
      tenantA._id.toString(),
      'user.beta@beta.com'
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
      'user.alpha@alpha.com'
    );
    expect(foundAInTenantB).toBeNull();

    // 6. Verify User A is strictly found within Tenant A's scope
    const validFoundA = await UserRepository.findByEmail(
      tenantA._id.toString(),
      'user.alpha@alpha.com'
    );
    expect(validFoundA).toBeDefined();
    expect(validFoundA?._id.toString()).toBe(userA.user.id);
  });
});
