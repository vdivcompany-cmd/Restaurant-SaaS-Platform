import { MenuRepository } from '../menu/repository.js';
import type { IProductSubDoc as IProduct } from '../menu/model.js';
import type { CreateProductDto, UpdateProductDto } from './validation.js';

export class ProductRepository {
  private menuRepo = new MenuRepository();

  public async create(tenantId: string, data: CreateProductDto): Promise<IProduct> {
    return await this.menuRepo.addOrUpdateProduct(tenantId, data as any);
  }

  public async findAll(tenantId: string, _categoryId?: string): Promise<IProduct[]> {
    return await this.menuRepo.findAllProducts(tenantId);
  }

  public async findById(tenantId: string, productId: string): Promise<IProduct | null> {
    return await this.menuRepo.findProductById(tenantId, productId);
  }

  public async update(tenantId: string, productId: string, data: UpdateProductDto): Promise<IProduct | null> {
    return await this.menuRepo.updateProduct(tenantId, productId, data as any);
  }

  public async delete(tenantId: string, productId: string): Promise<boolean> {
    return await this.menuRepo.deleteProduct(tenantId, productId);
  }
}

