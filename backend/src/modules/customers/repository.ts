import { CustomerModel, type ICustomer } from './model.js';
import { tenantQuery } from '../../utils/tenantQuery.js';
import type { CreateCustomerDto, UpdateCustomerDto } from './validation.js';

export class CustomerRepository {
  public async create(tenantId: string, data: CreateCustomerDto): Promise<ICustomer> {
    return (await tenantQuery.create(CustomerModel, tenantId, data)) as ICustomer;
  }

  public async findAll(tenantId: string): Promise<ICustomer[]> {
    return await tenantQuery.find(CustomerModel, tenantId).exec();
  }

  public async findById(tenantId: string, id: string): Promise<ICustomer | null> {
    return await tenantQuery.findOne(CustomerModel, tenantId, { _id: id }).exec();
  }

  public async update(tenantId: string, id: string, data: UpdateCustomerDto): Promise<ICustomer | null> {
    return await tenantQuery.findOneAndUpdate(CustomerModel, tenantId, { _id: id }, data, { new: true }).exec();
  }

  public async delete(tenantId: string, id: string): Promise<boolean> {
    const res = await tenantQuery.deleteOne(CustomerModel, tenantId, { _id: id }).exec();
    return res.deletedCount > 0;
  }
}
