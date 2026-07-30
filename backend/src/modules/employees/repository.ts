import { EmployeeModel, type IEmployee } from './model.js';
import { tenantQuery } from '../../utils/tenantQuery.js';
import type { CreateEmployeeDto, UpdateEmployeeDto } from './validation.js';

export class EmployeeRepository {
  public async create(tenantId: string, data: CreateEmployeeDto): Promise<IEmployee> {
    return (await tenantQuery.create(EmployeeModel, tenantId, data)) as IEmployee;
  }

  public async findAll(tenantId: string, branchId?: string): Promise<IEmployee[]> {
    const filter: Record<string, unknown> = {};
    if (branchId) filter['branchId'] = branchId;
    return await tenantQuery.find(EmployeeModel, tenantId, filter).exec();
  }

  public async findById(tenantId: string, id: string): Promise<IEmployee | null> {
    return await tenantQuery.findOne(EmployeeModel, tenantId, { _id: id }).exec();
  }

  public async update(tenantId: string, id: string, data: UpdateEmployeeDto): Promise<IEmployee | null> {
    return await tenantQuery.findOneAndUpdate(EmployeeModel, tenantId, { _id: id }, data, { new: true }).exec();
  }

  public async delete(tenantId: string, id: string): Promise<boolean> {
    const res = await tenantQuery.deleteOne(EmployeeModel, tenantId, { _id: id }).exec();
    return res.deletedCount > 0;
  }
}
