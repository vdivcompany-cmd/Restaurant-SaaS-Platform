import { CategoryModel, type ICategory } from './model.js';
import { tenantQuery } from '../../utils/tenantQuery.js';
import type { CreateCategoryDto, UpdateCategoryDto } from './validation.js';

export class CategoryRepository {
  public async create(tenantId: string, data: CreateCategoryDto): Promise<ICategory> {
    return (await tenantQuery.create(CategoryModel, tenantId, data)) as ICategory;
  }

  public async findAll(tenantId: string, branchId?: string): Promise<ICategory[]> {
    const filter: Record<string, unknown> = { isActive: true };
    if (branchId) filter['branchId'] = branchId;
    return await tenantQuery.find(CategoryModel, tenantId, filter).sort({ displayOrder: 1 }).exec();
  }

  public async findById(tenantId: string, categoryId: string): Promise<ICategory | null> {
    return await tenantQuery.findOne(CategoryModel, tenantId, { _id: categoryId }).exec();
  }

  public async update(tenantId: string, categoryId: string, data: UpdateCategoryDto): Promise<ICategory | null> {
    return await tenantQuery.findOneAndUpdate(CategoryModel, tenantId, { _id: categoryId }, data, { new: true }).exec();
  }

  public async delete(tenantId: string, categoryId: string): Promise<boolean> {
    const res = await tenantQuery.deleteOne(CategoryModel, tenantId, { _id: categoryId }).exec();
    return res.deletedCount > 0;
  }
}
