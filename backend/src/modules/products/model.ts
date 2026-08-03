import { MenuModel, type IProductSubDoc } from '../menu/model.js';

export type IProduct = IProductSubDoc;

export const ProductModel: any = {
  async findOne(query: { tenantId?: any; name?: string; _id?: any }) {
    const tenantIdStr = query.tenantId?.toString();
    const menu = tenantIdStr
      ? await MenuModel.findOne({ tenantId: tenantIdStr }).populate('products.variantIds').exec()
      : await MenuModel.findOne().populate('products.variantIds').exec();
    if (!menu) return null;
    if (query._id) {
      return menu.products.id(query._id) || null;
    }
    if (query.name) {
      return menu.products.find((p) => p.name === query.name) || null;
    }
    return menu.products[0] || null;
  },

  async find(query: { tenantId?: any }) {
    const tenantIdStr = query.tenantId?.toString();
    const menu = tenantIdStr
      ? await MenuModel.findOne({ tenantId: tenantIdStr }).populate('products.variantIds').exec()
      : await MenuModel.findOne().populate('products.variantIds').exec();
    return menu ? menu.products : [];
  },

  async create(data: any) {
    const { MenuRepository } = await import('../menu/repository.js');
    const repo = new MenuRepository();
    return await repo.addOrUpdateProduct(data.tenantId?.toString(), data);
  },
};


