import mongoose, { type ClientSession, type Types } from 'mongoose';
import { CategoryModel, type ICategory } from '../categories/model.js';
import { ProductModel, type IProduct } from '../products/model.js';
import { VariantModel, type IVariant } from '../variants/model.js';
import { tenantQuery } from '../../utils/tenantQuery.js';
import type { BulkImportPayload } from './validation.js';

export interface BulkImportResult {
  categoriesCount: number;
  productsCount: number;
  variantsCount: number;
}

export class MenuRepository {
  /**
   * Performs an atomic bulk import of menu categories, products, and variants.
   * Encapsulated inside repository using tenantQuery.
   */
  public async bulkImport(
    tenantId: string,
    payload: BulkImportPayload,
    session?: ClientSession
  ): Promise<BulkImportResult> {
    let categoriesCount = 0;
    let productsCount = 0;
    let variantsCount = 0;

    for (const catData of payload.categories) {
      // 1. Find existing category or create new category using tenantQuery helper
      let category = await tenantQuery.findOne<ICategory>(
        CategoryModel,
        tenantId,
        { name: catData.name }
      );

      if (!category) {
        const [newCat] = await CategoryModel.create(
          [
            {
              tenantId,
              name: catData.name,
              displayOrder: catData.displayOrder,
              isActive: true,
            },
          ],
          session ? { session } : {}
        );
        category = newCat;
        categoriesCount++;
      }

      // 2. Import Products for this Category
      for (const prodData of catData.products) {
        const createdVariantIds: Types.ObjectId[] = [];

        // Import Variants for this product
        if (prodData.variants && prodData.variants.length > 0) {
          for (const varData of prodData.variants) {
            const [variant] = await VariantModel.create(
              [
                {
                  tenantId,
                  name: varData.name,
                  minSelect: varData.minSelect,
                  maxSelect: varData.maxSelect,
                  options: varData.options,
                },
              ],
              session ? { session } : {}
            );
            createdVariantIds.push(variant._id as Types.ObjectId);
            variantsCount++;
          }
        }

        // Create product
        await ProductModel.create(
          [
            {
              tenantId,
              categoryId: category._id,
              name: prodData.name,
              description: prodData.description,
              basePrice: prodData.basePrice,
              imageUrl: prodData.imageUrl || undefined,
              isAvailable: true,
              variantIds: createdVariantIds,
            },
          ],
          session ? { session } : {}
        );
        productsCount++;
      }
    }

    return { categoriesCount, productsCount, variantsCount };
  }
}
