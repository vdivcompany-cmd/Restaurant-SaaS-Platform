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
}
