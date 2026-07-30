import { BranchRepository } from './repository.js';
import type { IBranch } from './model.js';
import type { CreateBranchDto, UpdateBranchDto } from './validation.js';
import { AppError } from '../../middleware/errorHandler.middleware.js';

export class BranchService {
  private repo = new BranchRepository();

  public async createBranch(tenantId: string, dto: CreateBranchDto): Promise<IBranch> {
    return await this.repo.create(tenantId, dto);
  }

  public async listBranches(tenantId: string): Promise<IBranch[]> {
    return await this.repo.findAll(tenantId);
  }

  public async getBranch(tenantId: string, branchId: string): Promise<IBranch> {
    const branch = await this.repo.findById(tenantId, branchId);
    if (!branch) throw new AppError('Branch not found or out of scope', 404);
    return branch;
  }

  public async updateBranch(tenantId: string, branchId: string, dto: UpdateBranchDto): Promise<IBranch> {
    const branch = await this.repo.update(tenantId, branchId, dto);
    if (!branch) throw new AppError('Branch not found or out of scope', 404);
    return branch;
  }

  public async deleteBranch(tenantId: string, branchId: string): Promise<void> {
    const success = await this.repo.delete(tenantId, branchId);
    if (!success) throw new AppError('Branch not found or out of scope', 404);
  }
}
