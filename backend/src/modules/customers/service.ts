import { CustomerRepository } from './repository.js';
import type { ICustomer } from './model.js';
import type { CreateCustomerDto, UpdateCustomerDto } from './validation.js';
import { AppError } from '../../middleware/errorHandler.middleware.js';

export class CustomerService {
  private repo = new CustomerRepository();

  public async createCustomer(tenantId: string, dto: CreateCustomerDto): Promise<ICustomer> {
    return await this.repo.create(tenantId, dto);
  }

  public async listCustomers(tenantId: string): Promise<ICustomer[]> {
    return await this.repo.findAll(tenantId);
  }

  public async getCustomer(tenantId: string, id: string): Promise<ICustomer> {
    const c = await this.repo.findById(tenantId, id);
    if (!c) throw new AppError('Customer not found or out of scope', 404);
    return c;
  }

  public async updateCustomer(tenantId: string, id: string, dto: UpdateCustomerDto): Promise<ICustomer> {
    const c = await this.repo.update(tenantId, id, dto);
    if (!c) throw new AppError('Customer not found or out of scope', 404);
    return c;
  }

  public async deleteCustomer(tenantId: string, id: string): Promise<void> {
    const success = await this.repo.delete(tenantId, id);
    if (!success) throw new AppError('Customer not found or out of scope', 404);
  }
}
