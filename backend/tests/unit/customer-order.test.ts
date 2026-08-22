import { describe, it, expect } from 'vitest';
import { createCustomerOrderSchema } from '../../src/modules/orders/validation.js';

describe('Customer Order Validation (TDD)', () => {
  const validProductId = '6a85e588d0b508058fc5008c';
  const validTenantId = '6a85e588d0b508058fc5008c';
  const validBranchId = '6a85e588d0b508058fc5008e';

  it('should accept valid TAKEAWAY order without deliveryAddress', () => {
    const payload = {
      tenantId: validTenantId,
      branchId: validBranchId,
      channel: 'TAKEAWAY',
      customerName: 'Ahmed Ali',
      customerPhone: '01012345678',
      items: [
        {
          productId: validProductId,
          quantity: 2,
        },
      ],
    };

    const result = createCustomerOrderSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.channel).toBe('TAKEAWAY');
      expect(result.data.customerName).toBe('Ahmed Ali');
      expect(result.data.customerPhone).toBe('01012345678');
      expect(result.data.items).toHaveLength(1);
    }
  });

  it('should accept valid DELIVERY order with deliveryAddress', () => {
    const payload = {
      tenantId: validTenantId,
      branchId: validBranchId,
      channel: 'DELIVERY',
      customerName: 'Sara Mohamed',
      customerPhone: '01198765432',
      deliveryAddress: '15 Tahrir St, Floor 4, Apt 8, Cairo',
      items: [
        {
          productId: validProductId,
          quantity: 1,
        },
      ],
    };

    const result = createCustomerOrderSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.channel).toBe('DELIVERY');
      expect(result.data.deliveryAddress).toBe('15 Tahrir St, Floor 4, Apt 8, Cairo');
    }
  });

  it('should reject DELIVERY order if deliveryAddress is missing or too short', () => {
    const payload = {
      tenantId: validTenantId,
      branchId: validBranchId,
      channel: 'DELIVERY',
      customerName: 'Sara Mohamed',
      customerPhone: '01198765432',
      items: [
        {
          productId: validProductId,
          quantity: 1,
        },
      ],
    };

    const result = createCustomerOrderSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('should reject order if customerName or customerPhone is missing or invalid', () => {
    const payload = {
      tenantId: validTenantId,
      branchId: validBranchId,
      channel: 'TAKEAWAY',
      customerName: 'A', // too short
      customerPhone: '123', // too short
      items: [
        {
          productId: validProductId,
          quantity: 1,
        },
      ],
    };

    const result = createCustomerOrderSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });
});
