import { describe, it, expect, vi } from 'vitest';
import { tenantQuery, TenantScopeError } from '../../src/utils/tenantQuery.js';

describe('TenantQuery Helper', () => {
  const dummyModel = {
    find: vi.fn(),
    findOne: vi.fn(),
    updateOne: vi.fn(),
    updateMany: vi.fn(),
    deleteOne: vi.fn(),
    deleteMany: vi.fn(),
    countDocuments: vi.fn(),
    aggregate: vi.fn(),
    create: vi.fn(),
  } as any;

  it('should throw TenantScopeError if tenantId is missing, empty, or undefined', () => {
    expect(() => tenantQuery.find(dummyModel, '', {})).toThrow(TenantScopeError);
    expect(() => tenantQuery.find(dummyModel, undefined as any, {})).toThrow(TenantScopeError);
    expect(() => tenantQuery.findOne(dummyModel, '   ', {})).toThrow(TenantScopeError);
  });

  it('should inject tenantId into find query filter', () => {
    const tenantId = 'tenant_123';
    tenantQuery.find(dummyModel, tenantId, { status: 'active' });
    expect(dummyModel.find).toHaveBeenCalledWith({ status: 'active', tenantId }, undefined, undefined);
  });

  it('should inject tenantId into findOne query filter', () => {
    const tenantId = 'tenant_123';
    tenantQuery.findOne(dummyModel, tenantId, { email: 'test@example.com' });
    expect(dummyModel.findOne).toHaveBeenCalledWith({ email: 'test@example.com', tenantId }, undefined, undefined);
  });

  it('should inject tenantId into updateOne query filter', () => {
    const tenantId = 'tenant_123';
    tenantQuery.updateOne(dummyModel, tenantId, { _id: 'doc_1' }, { $set: { name: 'New' } });
    expect(dummyModel.updateOne).toHaveBeenCalledWith({ _id: 'doc_1', tenantId }, { $set: { name: 'New' } }, undefined);
  });

  it('should inject tenantId into document creation', () => {
    const tenantId = 'tenant_123';
    tenantQuery.create(dummyModel, tenantId, { name: 'Sample Item' });
    expect(dummyModel.create).toHaveBeenCalledWith({ name: 'Sample Item', tenantId });
  });

  it('should prepend $match stage for tenantId in aggregate pipeline', () => {
    const tenantId = 'tenant_123';
    tenantQuery.aggregate(dummyModel, tenantId, [{ $group: { _id: '$status' } }]);
    expect(dummyModel.aggregate).toHaveBeenCalledWith([
      { $match: { tenantId } },
      { $group: { _id: '$status' } },
    ]);
  });
});
