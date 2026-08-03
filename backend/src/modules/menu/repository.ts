import { Types, type ClientSession } from 'mongoose';
import { CategoryModel, type ICategory } from '../categories/model.js';
import { VariantModel } from '../variants/model.js';
import { MenuModel, type IMenu, type IProductSubDoc } from './model.js';
import { tenantQuery } from '../../utils/tenantQuery.js';
import type { BulkImportPayload } from './validation.js';

export interface BulkImportResult {
  categoriesCount: number;
  productsCount: number;
  variantsCount: number;
}

export class MenuRepository {
  /**
   * Ensures a active Menu document exists for the tenant.
   */
  public async findOrCreateMenu(tenantId: string, session?: ClientSession): Promise<IMenu> {
    let menu = await tenantQuery.findOne<IMenu>(MenuModel, tenantId, {});
    if (!menu) {
      const [newMenu] = await MenuModel.create(
        [
          {
            tenantId: new Types.ObjectId(tenantId),
            name: 'Main Menu',
            isActive: true,
            products: [],
          },
        ],
        session ? { session } : {}
      );
      if (!newMenu) throw new Error('Failed to initialize restaurant menu');
      menu = newMenu;
    }
    return menu;
  }

  /**
   * Performs an atomic bulk import of menu categories, products, and variants
   * directly into the MenuModel products array with strict deduplication by product name.
   */
  public async bulkImport(
    tenantId: string,
    payload: BulkImportPayload,
    session?: ClientSession
  ): Promise<BulkImportResult> {
    let categoriesCount = 0;
    let productsCount = 0;
    let variantsCount = 0;

    const menu = await this.findOrCreateMenu(tenantId, session);

    for (const catData of payload.categories) {
      // 1. Find existing category or create new category
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
        if (!newCat) {
          throw new Error('Failed to create category');
        }
        category = newCat;
        categoriesCount++;
      }

      // 2. Process Products for this Category
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
            if (variant) {
              createdVariantIds.push(variant._id as Types.ObjectId);
              variantsCount++;
            }
          }
        }

        // Deduplicate against existing products array in MenuModel by normalized name
        const normalizedName = prodData.name.trim().toLowerCase();
        const existingProduct = menu.products.find(
          (p) => p.name.trim().toLowerCase() === normalizedName
        );

        if (existingProduct) {
          // Update existing product in menu sub-document array
          existingProduct.basePrice = prodData.basePrice;
          if (prodData.description) existingProduct.description = prodData.description;
          if (prodData.imageUrl) existingProduct.imageUrl = prodData.imageUrl;
          existingProduct.categoryId = category._id as Types.ObjectId;
          existingProduct.categoryName = category.name;
          if (createdVariantIds.length > 0) existingProduct.variantIds = createdVariantIds;
        } else {
          // Push new product sub-document
          menu.products.push({
            _id: new Types.ObjectId(),
            name: prodData.name.trim(),
            description: prodData.description,
            basePrice: prodData.basePrice,
            categoryId: category._id as Types.ObjectId,
            categoryName: category.name,
            imageUrl: prodData.imageUrl,
            isAvailable: true,
            variantIds: createdVariantIds,
            createdAt: new Date(),
            updatedAt: new Date(),
          } as IProductSubDoc);
        }

        productsCount++;
      }
    }

    await menu.save(session ? { session } : undefined);

    return { categoriesCount, productsCount, variantsCount };
  }

  /**
   * Adds or updates a product in the restaurant's menu array.
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
    const menu = await this.findOrCreateMenu(tenantId);
    const normalizedName = prodData.name.trim().toLowerCase();
    let existingProduct = menu.products.find((p) => p.name.trim().toLowerCase() === normalizedName);

    let catName: string | undefined;
    let catIdObj: Types.ObjectId | undefined;
    if (prodData.categoryId) {
      catIdObj = new Types.ObjectId(prodData.categoryId);
      const cat = await CategoryModel.findById(prodData.categoryId);
      if (cat) catName = cat.name;
    }

    const varIdObjs = (prodData.variantIds || []).map((v) => new Types.ObjectId(v));

    if (existingProduct) {
      existingProduct.basePrice = prodData.basePrice;
      if (prodData.description !== undefined) existingProduct.description = prodData.description;
      if (prodData.imageUrl !== undefined) existingProduct.imageUrl = prodData.imageUrl;
      if (prodData.isAvailable !== undefined) existingProduct.isAvailable = prodData.isAvailable;
      if (catIdObj) existingProduct.categoryId = catIdObj;
      if (catName) existingProduct.categoryName = catName;
      if (varIdObjs.length > 0) existingProduct.variantIds = varIdObjs;
      existingProduct.updatedAt = new Date();
    } else {
      const newProd = {
        _id: new Types.ObjectId(),
        name: prodData.name.trim(),
        description: prodData.description,
        basePrice: prodData.basePrice,
        categoryId: catIdObj,
        categoryName: catName,
        imageUrl: prodData.imageUrl,
        isAvailable: prodData.isAvailable ?? true,
        variantIds: varIdObjs,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as IProductSubDoc;

      menu.products.push(newProd as any);
      existingProduct = menu.products[menu.products.length - 1];
    }

    await menu.save();
    return existingProduct as IProductSubDoc;
  }

  /**
   * Updates a product by ID inside the menu sub-document array.
   */
  public async updateProduct(
    tenantId: string,
    productId: string,
    updateData: Partial<{
      name: string;
      description: string;
      basePrice: number;
      categoryId: string;
      imageUrl: string;
      isAvailable: boolean;
      variantIds: string[];
    }>
  ): Promise<IProductSubDoc | null> {
    const menu = await this.findOrCreateMenu(tenantId);
    const prod = menu.products.id(productId);
    if (!prod) return null;

    if (updateData.name) prod.name = updateData.name.trim();
    if (updateData.description !== undefined) prod.description = updateData.description;
    if (updateData.basePrice !== undefined) prod.basePrice = updateData.basePrice;
    if (updateData.imageUrl !== undefined) prod.imageUrl = updateData.imageUrl;
    if (updateData.isAvailable !== undefined) prod.isAvailable = updateData.isAvailable;
    if (updateData.categoryId) {
      prod.categoryId = new Types.ObjectId(updateData.categoryId);
      const cat = await CategoryModel.findById(updateData.categoryId);
      if (cat) prod.categoryName = cat.name;
    }
    if (updateData.variantIds) {
      prod.variantIds = updateData.variantIds.map((v) => new Types.ObjectId(v));
    }
    prod.updatedAt = new Date();

    await menu.save();
    return prod;
  }

  /**
   * Deletes a product by ID from the menu sub-document array.
   */
  public async deleteProduct(tenantId: string, productId: string): Promise<boolean> {
    const menu = await this.findOrCreateMenu(tenantId);
    const prod = menu.products.id(productId);
    if (!prod) return false;

    prod.deleteOne();
    await menu.save();
    return true;
  }

  /**
   * Finds a product by ID inside the tenant's menu array.
   */
  public async findProductById(tenantId: string, productId: string): Promise<IProductSubDoc | null> {
    const menu = await tenantQuery.findOne<IMenu>(MenuModel, tenantId, {}).populate('products.variantIds').exec();
    if (!menu) return null;
    const prod = menu.products.id(productId);
    return prod || null;
  }

  /**
   * Returns all products inside the tenant's menu array.
   */
  public async findAllProducts(tenantId: string): Promise<IProductSubDoc[]> {
    const menu = await tenantQuery.findOne<IMenu>(MenuModel, tenantId, {}).populate('products.variantIds').exec();
    return menu ? menu.products : [];
  }
}

