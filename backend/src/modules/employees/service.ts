import { EmployeeRepository } from './repository.js';
import type { IEmployee } from './model.js';
import type { CreateEmployeeDto, UpdateEmployeeDto } from './validation.js';
import { AppError } from '../../middleware/errorHandler.middleware.js';

export class EmployeeService {
  private repo = new EmployeeRepository();

  public async createEmployee(tenantId: string, dto: CreateEmployeeDto): Promise<IEmployee> {
    return await this.repo.create(tenantId, dto);
  }

  public async listEmployees(tenantId: string, branchId?: string): Promise<IEmployee[]> {
    return await this.repo.findAll(tenantId, branchId);
  }

  public async getEmployee(tenantId: string, id: string): Promise<IEmployee> {
    const emp = await this.repo.findById(tenantId, id);
    if (!emp) throw new AppError('Employee not found or out of scope', 404);
    return emp;
  }

  public async updateEmployee(tenantId: string, id: string, dto: UpdateEmployeeDto): Promise<IEmployee> {
    const emp = await this.repo.update(tenantId, id, dto);
    if (!emp) throw new AppError('Employee not found or out of scope', 404);
    return emp;
  }

  public async deleteEmployee(tenantId: string, id: string): Promise<void> {
    const success = await this.repo.delete(tenantId, id);
    if (!success) throw new AppError('Employee not found or out of scope', 404);
  }
}
