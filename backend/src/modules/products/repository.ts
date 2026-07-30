import { ProductModel, type IProduct } from './model.js';
import { tenantQuery } from '../../utils/tenantQuery.js';
import type { CreateProductDto, UpdateProductDto } from './validation.js';

export class ProductRepository {
  public async create(tenantId: string, data: CreateProductDto): Promise<IProduct> {
    return (await tenantQuery.create(ProductModel, tenantId, data)) as IProduct;
  }

  public async findAll(tenantId: string, branchId?: string): Promise<IProduct[]> {
    const filter: Record<string, unknown> = { isAvailable: true };
    if (branchId) filter['branchId'] = branchId;
    return await tenantQuery.find(ProductModel, tenantId, filter).populate('variantIds').sort({ createdAt: -1 }).exec();
  }

  public async findById(tenantId: string, productId: string): Promise<IProduct | null> {
    return await tenantQuery.findOne(ProductModel, tenantId, { _id: productId }).populate('variantIds').exec();
  }

  public async update(tenantId: string, productId: string, data: UpdateProductDto): Promise<IProduct | null> {
    return await tenantQuery.findOneAndUpdate(ProductModel, tenantId, { _id: productId }, data, { new: true }).populate('variantIds').exec();
  }

  public async delete(tenantId: string, productId: string): Promise<boolean> {
    const res = await tenantQuery.deleteOne(ProductModel, tenantId, { _id: productId }).exec();
    return res.deletedCount > 0;
  }
}
