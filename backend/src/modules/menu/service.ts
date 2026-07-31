import { withTransactionOrFallback } from '../../utils/withTransactionOrFallback.js';
import { CategoryModel } from '../categories/model.js';
import { ProductModel } from '../products/model.js';
import { tenantQuery } from '../../utils/tenantQuery.js';
import { cacheService } from '../../services/cache/index.js';
import { MenuRepository, type BulkImportResult } from './repository.js';
import type { BulkImportPayload } from './validation.js';
import logger from '../../utils/logger.js';

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

    const [categories, products] = await Promise.all([
      tenantQuery.find(CategoryModel, tenantId, { isActive: true }).sort({ displayOrder: 1 }).exec(),
      tenantQuery.find(ProductModel, tenantId, { isAvailable: true }).populate({ path: 'variantIds', match: { tenantId } }).exec(),
    ]);

    const catalog: MenuCatalog = {
      tenantId,
      categories: categories.map((cat) => {
        const catIdStr = cat._id.toString();
        const catProducts = products.filter((p) => p.categoryId.toString() === catIdStr);
        return {
          id: catIdStr,
          name: cat.name,
          displayOrder: cat.displayOrder,
          products: catProducts,
        };
      }),
    };

    await cacheService.set(cacheKey, catalog, MENU_CACHE_TTL);
    return catalog;
  }

  /**
   * Bulk import catalog data atomically and invalidate Upstash Redis menu cache.
   */
  public async bulkImportMenu(tenantId: string, payload: BulkImportPayload): Promise<BulkImportResult> {
    const result = await withTransactionOrFallback(async (session) => {
      return await this.repository.bulkImport(tenantId, payload, session);
    });

    // Rule: Clear Upstash Redis menu cache on bulk import
    const cacheKey = `menu:catalog:${tenantId}`;
    await cacheService.del(cacheKey);
    logger.info({ tenantId, result }, 'Bulk menu import completed and cache invalidated');

    return result;
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
        const prepTime = prod.preparationTime ? ` | Prep time: ${prod.preparationTime} minutes` : '';

        let variantInfo = '';
        if (Array.isArray(prod.variantIds) && prod.variantIds.length > 0) {
          const vNames = prod.variantIds.map((v: any) => `${v.name} (+${v.additionalPrice || 0} EGP)`).join(', ');
          variantInfo = ` | Variants available: [${vNames}]`;
        }

        const textSummary = `Dish: ${prodName} | Category: ${cat.name} | Base Price: ${price} EGP | Description: ${desc}${prepTime}${variantInfo} | Available: ${prod.isAvailable ? 'Yes' : 'No'}`;

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
