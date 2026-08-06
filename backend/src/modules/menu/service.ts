import { withTransactionOrFallback } from '../../utils/withTransactionOrFallback.js';
import { CategoryModel } from '../categories/model.js';
import { tenantQuery } from '../../utils/tenantQuery.js';
import { cacheService } from '../../services/cache/index.js';
import { MenuRepository, type BulkImportResult } from './repository.js';
import type { BulkImportPayload } from './validation.js';
import { AppError } from '../../middleware/errorHandler.middleware.js';
import logger from '../../utils/logger.js';
import type { IProductSubDoc, ISourceDocument } from './model.js';

export interface MenuCatalog {
  tenantId: string;
  categories: Array<{
    id: string;
    name: string;
    displayOrder: number;
    products: Array<unknown>;
  }>;
}

const MENU_CACHE_TTL = 3600;

export class MenuService {
  private repository = new MenuRepository();

  public async getFullMenu(tenantId: string): Promise<MenuCatalog> {
    const cacheKey = `menu:catalog:${tenantId}`;
    const cached = await cacheService.get<MenuCatalog>(cacheKey);
    if (cached) {
      return cached;
    }

    const categories = await tenantQuery.find(CategoryModel, tenantId, { isActive: true }).sort({ displayOrder: 1 }).exec();
    const products = await this.repository.findAllProducts(tenantId);

    const catalog: MenuCatalog = {
      tenantId,
      categories: categories.map((cat) => {
        const catIdStr = cat._id.toString();
        const catProducts = products
          .filter((p) => p.categoryId && p.categoryId.toString() === catIdStr)
          .map((p: any) => {
            const pObj = p.toObject ? p.toObject() : p;
            return { ...pObj, variantIds: pObj.variants || [] };
          });
        return {
          id: catIdStr,
          name: cat.name,
          displayOrder: cat.displayOrder,
          products: catProducts,
        };
      }),
    };

    // If uncategorized products exist, include them in a default category
    const uncategorized = products.filter(
      (p) => !p.categoryId || !categories.some((c) => c._id.toString() === p.categoryId?.toString())
    );
    if (uncategorized.length > 0) {
      catalog.categories.push({
        id: 'uncategorized',
        name: 'General Specials',
        displayOrder: 99,
        products: uncategorized,
      });
    }

    await cacheService.set(cacheKey, catalog, MENU_CACHE_TTL);
    return catalog;
  }

  /**
   * Adds or updates a single or multi product item in the restaurant's menu array.
   */
  public async addOrUpdateProduct(
    tenantId: string,
    prodData: {
      name: string;
      description?: string;
      basePrice: number;
      categoryId?: string;
      imageUrl?: string;
      isAvailable?: boolean;
      variantIds?: string[];
    }
  ): Promise<IProductSubDoc> {
    const product = await this.repository.addOrUpdateProduct(tenantId, prodData);
    await cacheService.del(`menu:catalog:${tenantId}`);
    return product;
  }

  public async updateProduct(
    tenantId: string,
    productId: string,
    dto: any
  ): Promise<IProductSubDoc> {
    const updated = await this.repository.updateProduct(tenantId, productId, dto);
    if (!updated) throw new AppError('Product item not found in restaurant menu', 404);
    await cacheService.del(`menu:catalog:${tenantId}`);
    return updated;
  }

  public async deleteProduct(tenantId: string, productId: string): Promise<void> {
    const success = await this.repository.deleteProduct(tenantId, productId);
    if (!success) throw new AppError('Product item not found in restaurant menu', 404);
    await cacheService.del(`menu:catalog:${tenantId}`);
  }

  public async getProduct(tenantId: string, productId: string): Promise<IProductSubDoc> {
    const prod = await this.repository.findProductById(tenantId, productId);
    if (!prod) throw new AppError('Product item not found in restaurant menu', 404);
    return prod;
  }

  public async listProducts(tenantId: string, categoryId?: string): Promise<IProductSubDoc[]> {
    const products = await this.repository.findAllProducts(tenantId);
    if (categoryId) {
      return products.filter((p) => p.categoryId && p.categoryId.toString() === categoryId);
    }
    return products;
  }

  /**
   * Bulk import catalog data atomically and invalidate the Redis menu cache.
   * Vector embeddings are re-synced asynchronously by MenuRepository.bulkImport
   * (enqueues a 'rebuild-tenant' job on VECTOR_SYNC).
   */
  public async bulkImportMenu(tenantId: string, payload: BulkImportPayload): Promise<BulkImportResult> {
    const result = await withTransactionOrFallback(async (session) => {
      return await this.repository.bulkImport(tenantId, payload, session);
    });

    const cacheKey = `menu:catalog:${tenantId}`;
    await cacheService.del(cacheKey);
    logger.info({ tenantId, result }, 'Bulk menu import completed and cache invalidated');

    return result;
  }

  /**
   * Records a source document entry on the menu and invalidates the cache.
   * Called after a successful file-based import to preserve the audit trail.
   */
  public async recordSourceDocument(tenantId: string, entry: ISourceDocument): Promise<void> {
    await this.repository.pushSourceDocument(tenantId, entry);
    await cacheService.del(`menu:catalog:${tenantId}`);
  }

  /**
   * Generates a clean text catalog optimized for cloud n8n RAG workflows and Upstash Vector embeddings.
   */
  public async getRagCatalog(tenantId: string): Promise<{ tenantId: string; count: number; ragItems: Array<{ id: string; text: string; metadata: Record<string, unknown> }> }> {
    const catalog = await this.getFullMenu(tenantId);
    const ragItems: Array<{ id: string; text: string; metadata: Record<string, unknown> }> = [];

    for (const cat of catalog.categories) {
      for (const prod of cat.products as any[]) {
        const prodName = prod.name || 'Unnamed Dish';
        const price = prod.basePrice ?? 0;
        const desc = prod.description || 'Freshly prepared specialty dish.';

        let variantInfo = '';
        if (Array.isArray(prod.variants) && prod.variants.length > 0) {
          const vNames = prod.variants
            .map((v: any) => `${v.name} (${(v.options || []).map((o: any) => `${o.name} (+${o.price || o.additionalPrice || 0} EGP)`).join('/')})`)
            .join(', ');
          variantInfo = ` | Variants available: [${vNames}]`;
        }

        const textSummary = `Dish: ${prodName} | Category: ${cat.name} | Base Price: ${price} EGP | Description: ${desc}${variantInfo} | Available: ${prod.isAvailable ? 'Yes' : 'No'}`;

        ragItems.push({
          id: prod._id?.toString() || Math.random().toString(),
          text: textSummary,
          metadata: {
            productId: prod._id?.toString(),
            categoryName: cat.name,
            basePrice: price,
            isAvailable: prod.isAvailable,
            tenantId,
          },
        });
      }
    }

    return { tenantId, count: ragItems.length, ragItems };
  }
}

