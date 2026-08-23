import { CouponRepository } from './repository.js';
import type { ICoupon } from './model.js';
import type { CreateCouponDto, UpdateCouponDto } from './validation.js';
import { AppError } from '../../middleware/errorHandler.middleware.js';

export interface CouponValidationResult {
  valid: boolean;
  coupon?: {
    id: string;
    code: string;
    discountType: string;
    discountValue: number;
    discountPercentage?: number;
  };
  discountAmount?: number;
  discountPercentage?: number; // Maintained for backward-compatibility
  subtotal?: number;
  newTotal?: number;
  reason?: string;
}

export class CouponService {
  private repo = new CouponRepository();

  public async createCoupon(tenantId: string, dto: CreateCouponDto, creatorUserId?: string): Promise<ICoupon> {
    const payload = {
      ...dto,
      ...(creatorUserId ? { createdBy: creatorUserId as any } : {}),
    };
    return await this.repo.create(tenantId, payload as any);
  }

  public async listCoupons(tenantId: string): Promise<ICoupon[]> {
    return await this.repo.findAll(tenantId);
  }

  public async validateCoupon(
    tenantId: string,
    code: string,
    subtotal?: number
  ): Promise<CouponValidationResult> {
    if (!code || typeof code !== 'string') {
      return { valid: false, reason: 'Coupon code is required' };
    }

    const coupon = await this.repo.findByCode(tenantId, code.trim());
    if (!coupon || !coupon.isActive) {
      return { valid: false, reason: 'Invalid or deactivated promotional coupon' };
    }

    if (new Date() > new Date(coupon.expiresAt)) {
      return { valid: false, reason: 'Promotional coupon has expired' };
    }

    if (coupon.usageLimit && coupon.timesUsed >= coupon.usageLimit) {
      return { valid: false, reason: 'Coupon usage limit has been reached' };
    }

    const currentSubtotal = subtotal !== undefined && !isNaN(subtotal) ? Number(subtotal) : undefined;
    if (currentSubtotal !== undefined && coupon.minOrderAmount && currentSubtotal < coupon.minOrderAmount) {
      return {
        valid: false,
        reason: `Order subtotal must be at least ${coupon.minOrderAmount} to use this coupon`,
      };
    }

    // Calculate discount amount
    let discountAmount = 0;
    const discountType = coupon.discountType || 'PERCENTAGE';
    const discountValue = coupon.discountValue ?? coupon.discountPercentage ?? 0;

    if (currentSubtotal !== undefined) {
      if (discountType === 'PERCENTAGE') {
        const rawDiscount = (currentSubtotal * discountValue) / 100;
        discountAmount = coupon.maxDiscountCap
          ? Math.min(rawDiscount, coupon.maxDiscountCap)
          : rawDiscount;
      } else {
        // FIXED discount amount
        discountAmount = Math.min(discountValue, currentSubtotal);
      }
      discountAmount = Math.round(discountAmount * 100) / 100;
    }

    const isPercentage = discountType === 'PERCENTAGE';
    const newTotal = currentSubtotal !== undefined ? Math.max(0, currentSubtotal - discountAmount) : undefined;
    const res: CouponValidationResult = {
      valid: true,
      coupon: {
        id: coupon._id.toString(),
        code: coupon.code,
        discountType,
        discountValue,
        ...(isPercentage ? { discountPercentage: discountValue } : {}),
      },
      discountAmount,
      ...(isPercentage ? { discountPercentage: discountValue } : {}),
      ...(currentSubtotal !== undefined ? { subtotal: currentSubtotal } : {}),
      ...(newTotal !== undefined ? { newTotal } : {}),
    };

    return res;
  }

  public async recordCouponUsage(tenantId: string, codeOrId: string): Promise<void> {
    await this.repo.incrementUsage(tenantId, codeOrId);
  }

  public async updateCoupon(tenantId: string, id: string, dto: UpdateCouponDto): Promise<ICoupon> {
    const c = await this.repo.update(tenantId, id, dto);
    if (!c) throw new AppError('Coupon not found or out of scope', 404);
    return c;
  }

  public async deleteCoupon(tenantId: string, id: string): Promise<void> {
    const success = await this.repo.delete(tenantId, id);
    if (!success) throw new AppError('Coupon not found or out of scope', 404);
  }
}

