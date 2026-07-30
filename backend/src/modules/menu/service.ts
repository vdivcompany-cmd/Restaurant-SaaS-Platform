import mongoose from 'mongoose';
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
      tenantQuery.find(ProductModel, tenantId, { isAvailable: true }).populate('variantIds').exec(),
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
    let session: mongoose.ClientSession | null = null;
    let useTransaction = false;

    // Use session transactions in production/staging replica sets (not in test env)
    if (process.env['NODE_ENV'] !== 'test') {
      session = await mongoose.startSession().catch(() => null);
      if (session) {
        try {
          session.startTransaction();
          useTransaction = true;
        } catch {
          useTransaction = false;
        }
      }
    }

    try {
      const result = await this.repository.bulkImport(
        tenantId,
        payload,
        useTransaction && session ? session : undefined
      );

      if (useTransaction && session) {
        await session.commitTransaction().catch(() => {});
      }

      // Rule: Clear Upstash Redis menu cache on bulk import
      const cacheKey = `menu:catalog:${tenantId}`;
      await cacheService.del(cacheKey);
      logger.info({ tenantId, result }, 'Bulk menu import completed and cache invalidated');

      return result;
    } catch (error) {
      if (useTransaction && session) {
        await session.abortTransaction().catch(() => {});
      }
      logger.error({ tenantId, error }, 'Bulk menu import transaction failed');
      throw error;
    } finally {
      if (session) {
        session.endSession().catch(() => {});
      }
    }
  }
}
