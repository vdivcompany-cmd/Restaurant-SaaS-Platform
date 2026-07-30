import { ProductRepository } from './repository.js';
import type { IProduct } from './model.js';
import type { CreateProductDto, UpdateProductDto } from './validation.js';
import { AppError } from '../../middleware/errorHandler.middleware.js';
import { cacheService } from '../../services/cache/index.js';

export class ProductService {
  private repo = new ProductRepository();

  private async invalidateMenuCache(tenantId: string): Promise<void> {
    await cacheService.del(`menu:catalog:${tenantId}`);
  }

  public async createProduct(tenantId: string, dto: CreateProductDto): Promise<IProduct> {
    const prod = await this.repo.create(tenantId, dto);
    await this.invalidateMenuCache(tenantId);
    return prod;
  }

  public async listProducts(tenantId: string, branchId?: string): Promise<IProduct[]> {
    return await this.repo.findAll(tenantId, branchId);
  }

  public async getProduct(tenantId: string, productId: string): Promise<IProduct> {
    const prod = await this.repo.findById(tenantId, productId);
    if (!prod) throw new AppError('Product not found or out of scope', 404);
    return prod;
  }

  public async updateProduct(tenantId: string, productId: string, dto: UpdateProductDto): Promise<IProduct> {
    const prod = await this.repo.update(tenantId, productId, dto);
    if (!prod) throw new AppError('Product not found or out of scope', 404);
    await this.invalidateMenuCache(tenantId);
    return prod;
  }

  public async deleteProduct(tenantId: string, productId: string): Promise<void> {
    const success = await this.repo.delete(tenantId, productId);
    if (!success) throw new AppError('Product not found or out of scope', 404);
    await this.invalidateMenuCache(tenantId);
  }
}
