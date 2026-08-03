import { MenuService } from '../menu/service.js';
import type { IProductSubDoc as IProduct } from '../menu/model.js';
import type { CreateProductDto, UpdateProductDto } from './validation.js';

export class ProductService {
  private menuService = new MenuService();

  public async createProduct(tenantId: string, dto: CreateProductDto): Promise<IProduct> {
    return await this.menuService.addOrUpdateProduct(tenantId, dto as any);
  }

  public async listProducts(tenantId: string, categoryId?: string): Promise<IProduct[]> {
    return await this.menuService.listProducts(tenantId, categoryId);
  }

  public async getProduct(tenantId: string, productId: string): Promise<IProduct> {
    return await this.menuService.getProduct(tenantId, productId);
  }

  public async updateProduct(tenantId: string, productId: string, dto: UpdateProductDto): Promise<IProduct> {
    return await this.menuService.updateProduct(tenantId, productId, dto as any);
  }

  public async deleteProduct(tenantId: string, productId: string): Promise<void> {
    await this.menuService.deleteProduct(tenantId, productId);
  }
}

