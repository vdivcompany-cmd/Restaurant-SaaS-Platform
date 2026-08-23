import { describe, it, expect } from 'vitest';
import { createOrderSchema, cashierConfirmSchema, kitchenCompleteSchema } from '../../src/modules/orders/validation.js';
import { createCouponSchema } from '../../src/modules/coupons/validation.js';

describe('Embedded Customer & Two-Stage Order Validation (TDD)', () => {
  const validTenantId = '6a85e588d0b508058fc5008c';
  const validBranchId = '6a85e588d0b508058fc5008e';
  const validProductId = '6a85e588d0b508058fc5008a';
  const validTableId = '6a85e588d0b508058fc5008f';

  it('should accept an order with embedded customer data and coupon code', () => {
    const payload = {
      tenantId: validTenantId,
      branchId: validBranchId,
      channel: 'DINE_IN',
      tableId: validTableId,
      customer: {
        name: 'Kareem Tarek',
        phone: '01099887766',
        email: 'kareem@example.com',
        deliveryAddress: 'Table 4 VIP',
        notes: 'Extra crispy crust please',
      },
      couponCode: 'SAVE20',
      discountAmount: 25,
      items: [
        {
          productId: validProductId,
          name: 'Supreme Pizza',
          quantity: 1,
          unitPrice: 125,
          totalPrice: 125,
        },
      ],
      subtotal: 125,
      taxAmount: 0,
      totalAmount: 100,
    };

    const parsed = createOrderSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.customer?.name).toBe('Kareem Tarek');
      expect(parsed.data.customer?.phone).toBe('01099887766');
      expect(parsed.data.couponCode).toBe('SAVE20');
      expect(parsed.data.discountAmount).toBe(25);
      expect(parsed.data.totalAmount).toBe(100);
    }
  });

  it('should validate cashier confirmation schema', () => {
    const valid = cashierConfirmSchema.safeParse({ notes: 'Payment verified cash' });
    expect(valid.success).toBe(true);

    const empty = cashierConfirmSchema.safeParse({});
    expect(empty.success).toBe(true);
  });

  it('should validate kitchen completion schema', () => {
    const valid = kitchenCompleteSchema.safeParse({ kitchenNotes: 'All items cooked and packed' });
    expect(valid.success).toBe(true);
  });
});

describe('Multi-Role Coupons System Validation (TDD)', () => {
  it('should accept percentage discount coupon with caps and limits', () => {
    const payload = {
      code: 'MEGA20',
      discountType: 'PERCENTAGE',
      discountValue: 20,
      minOrderAmount: 100,
      maxDiscountCap: 50,
      usageLimit: 500,
      expiresAt: '2027-01-01T00:00:00.000Z',
      isActive: true,
    };

    const parsed = createCouponSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.code).toBe('MEGA20');
      expect(parsed.data.discountType).toBe('PERCENTAGE');
      expect(parsed.data.discountValue).toBe(20);
      expect(parsed.data.discountPercentage).toBe(20);
      expect(parsed.data.minOrderAmount).toBe(100);
      expect(parsed.data.maxDiscountCap).toBe(50);
      expect(parsed.data.usageLimit).toBe(500);
    }
  });

  it('should accept fixed amount discount coupon', () => {
    const payload = {
      code: 'OFF50EGP',
      discountType: 'FIXED',
      discountValue: 50,
      minOrderAmount: 200,
      expiresAt: '2027-01-01T00:00:00.000Z',
    };

    const parsed = createCouponSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.code).toBe('OFF50EGP');
      expect(parsed.data.discountType).toBe('FIXED');
      expect(parsed.data.discountValue).toBe(50);
      expect(parsed.data.minOrderAmount).toBe(200);
    }
  });
});
