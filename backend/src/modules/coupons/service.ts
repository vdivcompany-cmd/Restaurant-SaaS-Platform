import { CouponRepository } from './repository.js';
import type { ICoupon } from './model.js';
import type { CreateCouponDto, UpdateCouponDto } from './validation.js';
import { AppError } from '../../middleware/errorHandler.middleware.js';

export class CouponService {
  private repo = new CouponRepository();

  public async createCoupon(tenantId: string, dto: CreateCouponDto): Promise<ICoupon> {
    return await this.repo.create(tenantId, dto);
  }

  public async listCoupons(tenantId: string): Promise<ICoupon[]> {
    return await this.repo.findAll(tenantId);
  }

  public async validateCoupon(tenantId: string, code: string): Promise<{ valid: boolean; discountPercentage?: number; reason?: string }> {
    const coupon = await this.repo.findByCode(tenantId, code);
    if (!coupon || !coupon.isActive) {
      return { valid: false, reason: 'Invalid or deactivated promotional coupon' };
    }
    if (new Date() > new Date(coupon.expiresAt)) {
      return { valid: false, reason: 'Promotional coupon has expired' };
    }
    return { valid: true, discountPercentage: coupon.discountPercentage };
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
