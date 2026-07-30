import { VariantRepository } from './repository.js';
import type { IVariant } from './model.js';
import type { CreateVariantDto, UpdateVariantDto } from './validation.js';
import { AppError } from '../../middleware/errorHandler.middleware.js';
import { cacheService } from '../../services/cache/index.js';

export class VariantService {
  private repo = new VariantRepository();

  private async invalidateMenuCache(tenantId: string): Promise<void> {
    await cacheService.del(`menu:catalog:${tenantId}`);
  }

  public async createVariant(tenantId: string, dto: CreateVariantDto): Promise<IVariant> {
    const v = await this.repo.create(tenantId, dto);
    await this.invalidateMenuCache(tenantId);
    return v;
  }

  public async listVariants(tenantId: string, branchId?: string): Promise<IVariant[]> {
    return await this.repo.findAll(tenantId, branchId);
  }

  public async getVariant(tenantId: string, variantId: string): Promise<IVariant> {
    const v = await this.repo.findById(tenantId, variantId);
    if (!v) throw new AppError('Variant not found or out of scope', 404);
    return v;
  }

  public async updateVariant(tenantId: string, variantId: string, dto: UpdateVariantDto): Promise<IVariant> {
    const v = await this.repo.update(tenantId, variantId, dto);
    if (!v) throw new AppError('Variant not found or out of scope', 404);
    await this.invalidateMenuCache(tenantId);
    return v;
  }

  public async deleteVariant(tenantId: string, variantId: string): Promise<void> {
    const success = await this.repo.delete(tenantId, variantId);
    if (!success) throw new AppError('Variant not found or out of scope', 404);
    await this.invalidateMenuCache(tenantId);
  }
}
