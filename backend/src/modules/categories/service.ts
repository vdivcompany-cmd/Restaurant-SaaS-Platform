import { CategoryRepository } from './repository.js';
import type { ICategory } from './model.js';
import type { CreateCategoryDto, UpdateCategoryDto } from './validation.js';
import { AppError } from '../../middleware/errorHandler.middleware.js';
import { cacheService } from '../../services/cache/index.js';

export class CategoryService {
  private repo = new CategoryRepository();

  private async invalidateMenuCache(tenantId: string): Promise<void> {
    await cacheService.del(`menu:catalog:${tenantId}`);
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
    const cat = await this.repo.update(tenantId, categoryId, dto);
    if (!cat) throw new AppError('Category not found or out of scope', 404);
    await this.invalidateMenuCache(tenantId);
    return cat;
  }

  public async deleteCategory(tenantId: string, categoryId: string): Promise<void> {
    const success = await this.repo.delete(tenantId, categoryId);
    if (!success) throw new AppError('Category not found or out of scope', 404);
    await this.invalidateMenuCache(tenantId);
  }
}
