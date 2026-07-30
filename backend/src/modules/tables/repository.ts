import { TableModel, type ITable } from './model.js';
import { tenantQuery } from '../../utils/tenantQuery.js';
import type { CreateTableDto, UpdateTableDto } from './validation.js';

export class TableRepository {
  public async create(tenantId: string, data: CreateTableDto & { qrCodeToken: string }): Promise<ITable> {
    return (await tenantQuery.create(TableModel, tenantId, data)) as ITable;
  }

  public async findAll(tenantId: string, branchId?: string): Promise<ITable[]> {
    const filter: Record<string, unknown> = {};
    if (branchId) filter['branchId'] = branchId;
    return await tenantQuery.find(TableModel, tenantId, filter).sort({ number: 1 }).exec();
  }

  public async findById(tenantId: string, tableId: string): Promise<ITable | null> {
    return await tenantQuery.findOne(TableModel, tenantId, { _id: tableId }).exec();
  }

  public async findByQrToken(token: string): Promise<ITable | null> {
    return await TableModel.findOne({ qrCodeToken: token }).exec();
  }

  public async update(tenantId: string, tableId: string, data: UpdateTableDto): Promise<ITable | null> {
    return await tenantQuery.findOneAndUpdate(TableModel, tenantId, { _id: tableId }, data, { new: true }).exec();
  }

  public async delete(tenantId: string, tableId: string): Promise<boolean> {
    const res = await tenantQuery.deleteOne(TableModel, tenantId, { _id: tableId }).exec();
    return res.deletedCount > 0;
  }
}
