import { CategoryRepository } from './repository.js';
import type { ICategory } from './model.js';
import type { CreateCategoryDto, UpdateCategoryDto } from './validation.js';
import { AppError } from '../../middleware/errorHandler.middleware.js';
import { cacheService } from '../../services/cache/index.js';
import { MenuModel } from '../menu/model.js';
import { enqueueVectorSync } from '../vector/enqueue.js';

export class CategoryService {
  private repo = new CategoryRepository();

  private async invalidateMenuCache(tenantId: string): Promise<void> {
    await cacheService.del(`menu:catalog:${tenantId}`);
  }

  /**
   * Rewrites the cached `categoryName` field on every product subdoc under this
   * category, then triggers a full tenant vector rebuild so embeddings reflect
   * the new name. Delete-mode also unsets categoryId so orphan products don't
   * hold a dangling reference.
   */
  private async cascadeCategoryChange(
    tenantId: string,
    categoryId: string,
    change: { newName: string } | { deleted: true }
  ): Promise<void> {
    const menu = await MenuModel.findOne({ tenantId }).exec();
    if (!menu) return;

    let touched = false;
    for (const prod of menu.products) {
      if (!prod.categoryId || prod.categoryId.toString() !== categoryId) continue;
      if ('deleted' in change) {
        prod.set('categoryId', undefined);
        prod.set('categoryName', undefined);
      } else {
        prod.categoryName = change.newName;
      }
      prod.updatedAt = new Date();
      touched = true;
    }
    if (!touched) return;

    await menu.save();
    await enqueueVectorSync({ op: 'rebuild-tenant', tenantId });
  }

  public async createCategory(tenantId: string, dto: CreateCategoryDto): Promise<ICategory> {
    const cat = await this.repo.create(tenantId, dto);
    await this.invalidateMenuCache(tenantId);
    return cat;
  }

  public async listCategories(tenantId: string, branchId?: string): Promise<ICategory[]> {
    return await this.repo.findAll(tenantId, branchId);
  }

  public async getCategory(tenantId: string, categoryId: string): Promise<ICategory> {
    const cat = await this.repo.findById(tenantId, categoryId);
    if (!cat) throw new AppError('Category not found or out of scope', 404);
    return cat;
  }

  public async updateCategory(tenantId: string, categoryId: string, dto: UpdateCategoryDto): Promise<ICategory> {
    const before = await this.repo.findById(tenantId, categoryId);
    if (!before) throw new AppError('Category not found or out of scope', 404);

    const cat = await this.repo.update(tenantId, categoryId, dto);
    if (!cat) throw new AppError('Category not found or out of scope', 404);

    await this.invalidateMenuCache(tenantId);

    if (dto.name && dto.name !== before.name) {
      await this.cascadeCategoryChange(tenantId, categoryId, { newName: dto.name });
    }

    return cat;
  }

  public async deleteCategory(tenantId: string, categoryId: string): Promise<void> {
    const success = await this.repo.delete(tenantId, categoryId);
    if (!success) throw new AppError('Category not found or out of scope', 404);
    await this.invalidateMenuCache(tenantId);
    await this.cascadeCategoryChange(tenantId, categoryId, { deleted: true });
  }
}
