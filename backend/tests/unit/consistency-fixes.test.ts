import { describe, it, expect, vi } from 'vitest';
import { Types } from 'mongoose';
import { salesReportQuerySchema } from '../../src/modules/reports/validation.js';
import { createOrderSchema, offlineSyncSchema } from '../../src/modules/orders/validation.js';
import { tenantQuery } from '../../src/utils/tenantQuery.js';

describe('Backend Consistency & Compatibility Fixes', () => {
  describe('Fix 1A: salesReportQuerySchema', () => {
    it('should validate valid 24-hex branchId and optional dates', () => {
      const validHex = '507f1f77bcf86cd799439011';
      const parsed = salesReportQuerySchema.parse({ branchId: validHex });
      expect(parsed.branchId).toBe(validHex);
    });

    it('should throw on invalid branchId', () => {
      expect(() => salesReportQuerySchema.parse({ branchId: 'invalid-id' })).toThrow();
    });
  });

  describe('Fix 2A: Shared objectIdSchema in orders validation', () => {
    const validId = '507f1f77bcf86cd799439011';

    it('should accept valid objectIds for branchId, tableId, productId, variantId', () => {
      const validOrder = {
        branchId: validId,
        channel: 'DINE_IN',
        tableId: validId,
        items: [
          {
            productId: validId,
            name: 'Pizza',
            quantity: 1,
            unitPrice: 10,
            totalPrice: 10,
            selectedVariants: [{ variantId: validId, variantName: 'Large', priceDelta: 2 }],
          },
        ],
        subtotal: 10,
        totalAmount: 12,
      };

      const parsed = createOrderSchema.parse(validOrder);
      expect(parsed.branchId).toBe(validId);
      expect(parsed.tableId).toBe(validId);
      expect(parsed.items[0].productId).toBe(validId);
      expect(parsed.items[0].selectedVariants[0].variantId).toBe(validId);
    });

    it('should trim and validate branchId in offlineSyncSchema', () => {
      const parsed = offlineSyncSchema.parse({
        branchId: `  ${validId}  `,
        orders: [
          {
            channel: 'TAKEAWAY',
            items: [
              {
                productId: validId,
                name: 'Burger',
                quantity: 1,
                unitPrice: 5,
                totalPrice: 5,
              },
            ],
            subtotal: 5,
            totalAmount: 5,
          },
        ],
      });
      expect(parsed.branchId).toBe(validId);
    });

    it('should reject invalid hex strings', () => {
      expect(() =>
        createOrderSchema.parse({
          branchId: 'short',
          channel: 'TAKEAWAY',
          items: [],
          subtotal: 0,
          totalAmount: 0,
        })
      ).toThrow();
    });
  });

  describe('Fix 2C: Cast tenantId to ObjectId in scopeFilter', () => {
    it('should cast 24-character hex tenantId to Types.ObjectId', () => {
      const dummyModel = { find: vi.fn() } as any;
      const validHexTenant = '507f1f77bcf86cd799439011';

      tenantQuery.find(dummyModel, validHexTenant, { status: 'active' });

      expect(dummyModel.find).toHaveBeenCalledWith(
        {
          status: 'active',
          tenantId: new Types.ObjectId(validHexTenant),
        },
        undefined,
        undefined
      );
    });

    it('should leave non-ObjectId tenantId strings untouched', () => {
      const dummyModel = { find: vi.fn() } as any;
      const plainTenant = 'tenant_123';

      tenantQuery.find(dummyModel, plainTenant, { status: 'active' });

      expect(dummyModel.find).toHaveBeenCalledWith(
        {
          status: 'active',
          tenantId: plainTenant,
        },
        undefined,
        undefined
      );
    });
  });
});
