import { MenuModel, type IProductSubDoc } from '../menu/model.js';

export type IProduct = IProductSubDoc;

export const ProductModel: any = {
  async findOne(query: { tenantId?: any; name?: string; _id?: any }) {
    const tenantIdStr = query.tenantId?.toString();
    const menu = tenantIdStr
      ? await MenuModel.findOne({ tenantId: tenantIdStr }).exec()
      : await MenuModel.findOne().exec();
    if (!menu) return null;
    let item: any = null;
    if (query._id) {
      item = menu.products.id(query._id) || null;
    } else if (query.name) {
      item = menu.products.find((p) => p.name === query.name) || null;
    } else {
      item = menu.products[0] || null;
    }
    if (item && !item.variantIds) {
      item = item.toObject ? item.toObject() : item;
      item.variantIds = item.variants || [];
    }
    return item;
  },

  async find(query: { tenantId?: any }) {
    const tenantIdStr = query.tenantId?.toString();
    const menu = tenantIdStr
      ? await MenuModel.findOne({ tenantId: tenantIdStr }).exec()
      : await MenuModel.findOne().exec();
    if (!menu) return [];
    return menu.products.map((p: any) => {
      const obj = p.toObject ? p.toObject() : p;
      obj.variantIds = obj.variants || [];
      return obj;
    });
  },

  async create(data: any) {
    const { MenuRepository } = await import('../menu/repository.js');
    const repo = new MenuRepository();
    return await repo.addOrUpdateProduct(data.tenantId?.toString(), data);
  },
};


