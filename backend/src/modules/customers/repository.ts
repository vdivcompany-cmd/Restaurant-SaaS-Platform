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

  public async findByPhone(tenantId: string, phone: string): Promise<ICustomer | null> {
    return await tenantQuery.findOne(CustomerModel, tenantId, { phone }).exec();
  }

  /**
   * Find-or-create a customer by phone within a tenant.
   * If the customer already exists, update their name (in case it changed).
   */
  public async upsertByPhone(tenantId: string, name: string, phone: string): Promise<ICustomer> {
    const existing = await this.findByPhone(tenantId, phone);
    if (existing) {
      // Update name if it changed
      if (existing.name !== name) {
        existing.name = name;
        await existing.save();
      }
      return existing;
    }
    return await this.create(tenantId, { name, phone });
  }

  public async update(tenantId: string, id: string, data: UpdateCustomerDto): Promise<ICustomer | null> {
    return await tenantQuery.findOneAndUpdate(CustomerModel, tenantId, { _id: id }, data, { new: true }).exec();
  }

  public async delete(tenantId: string, id: string): Promise<boolean> {
    const res = await tenantQuery.deleteOne(CustomerModel, tenantId, { _id: id }).exec();
    return res.deletedCount > 0;
  }
}

