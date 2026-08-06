import { MenuDocumentModel, type IMenuDocument } from './model.js';
import { tenantQuery } from '../../utils/tenantQuery.js';
import type { UpdateMenuDocDto } from './validation.js';

export class MenuDocRepository {
  public async create(tenantId: string, data: Partial<IMenuDocument>): Promise<IMenuDocument> {
    return (await tenantQuery.create(MenuDocumentModel, tenantId, data)) as IMenuDocument;
  }

  public async findAll(tenantId: string, activeOnly = false): Promise<IMenuDocument[]> {
    const filter: Record<string, unknown> = {};
    if (activeOnly) filter['isActive'] = true;
    return await tenantQuery.find(MenuDocumentModel, tenantId, filter).sort({ createdAt: -1 }).exec();
  }

  public async findById(tenantId: string, id: string): Promise<IMenuDocument | null> {
    return await tenantQuery.findOne(MenuDocumentModel, tenantId, { _id: id }).exec();
  }

  public async update(tenantId: string, id: string, data: UpdateMenuDocDto): Promise<IMenuDocument | null> {
    return await tenantQuery.findOneAndUpdate(MenuDocumentModel, tenantId, { _id: id }, data, { new: true }).exec();
  }

  public async delete(tenantId: string, id: string): Promise<boolean> {
    const res = await tenantQuery.deleteOne(MenuDocumentModel, tenantId, { _id: id }).exec();
    return res.deletedCount > 0;
  }
}
