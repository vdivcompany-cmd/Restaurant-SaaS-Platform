import { CouponModel, type ICoupon } from './model.js';
import { tenantQuery } from '../../utils/tenantQuery.js';
import type { CreateCouponDto, UpdateCouponDto } from './validation.js';

export class CouponRepository {
  public async create(tenantId: string, data: CreateCouponDto): Promise<ICoupon> {
    return (await tenantQuery.create(CouponModel, tenantId, { ...data, expiresAt: new Date(data.expiresAt) })) as ICoupon;
  }

  public async findAll(tenantId: string): Promise<ICoupon[]> {
    return await tenantQuery.find(CouponModel, tenantId).exec();
  }

  public async findByCode(tenantId: string, code: string): Promise<ICoupon | null> {
    return await tenantQuery.findOne(CouponModel, tenantId, { code: code.toUpperCase() }).exec();
  }

  public async update(tenantId: string, id: string, data: UpdateCouponDto): Promise<ICoupon | null> {
    const updatePayload = { ...data, ...(data.expiresAt ? { expiresAt: new Date(data.expiresAt) } : {}) };
    return await tenantQuery.findOneAndUpdate(CouponModel, tenantId, { _id: id }, updatePayload, { new: true }).exec();
  }

  public async delete(tenantId: string, id: string): Promise<boolean> {
    const res = await tenantQuery.deleteOne(CouponModel, tenantId, { _id: id }).exec();
    return res.deletedCount > 0;
  }
}
