import { VariantModel, type IVariant } from './model.js';
import { tenantQuery } from '../../utils/tenantQuery.js';
import type { CreateVariantDto, UpdateVariantDto } from './validation.js';

export class VariantRepository {
  public async create(tenantId: string, data: CreateVariantDto): Promise<IVariant> {
    return (await tenantQuery.create(VariantModel, tenantId, data)) as IVariant;
  }

  public async findAll(tenantId: string, branchId?: string): Promise<IVariant[]> {
    const filter: Record<string, unknown> = {};
    if (branchId) filter['branchId'] = branchId;
    return await tenantQuery.find(VariantModel, tenantId, filter).exec();
  }

  public async findById(tenantId: string, variantId: string): Promise<IVariant | null> {
    return await tenantQuery.findOne(VariantModel, tenantId, { _id: variantId }).exec();
  }

  public async update(tenantId: string, variantId: string, data: UpdateVariantDto): Promise<IVariant | null> {
    return await tenantQuery.findOneAndUpdate(VariantModel, tenantId, { _id: variantId }, data, { new: true }).exec();
  }

  public async delete(tenantId: string, variantId: string): Promise<boolean> {
    const res = await tenantQuery.deleteOne(VariantModel, tenantId, { _id: variantId }).exec();
    return res.deletedCount > 0;
  }
}
