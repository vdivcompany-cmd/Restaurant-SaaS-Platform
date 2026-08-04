import type { ClientSession } from 'mongoose';
import { BranchModel, type IBranch } from './model.js';
import { tenantQuery } from '../../utils/tenantQuery.js';
import type { CreateBranchDto, UpdateBranchDto } from './validation.js';

export class BranchRepository {
  public async create(tenantId: string, data: CreateBranchDto, session?: ClientSession): Promise<IBranch> {
    return (await tenantQuery.create(BranchModel, tenantId, data, session ? { session } : undefined)) as IBranch;
  }

  public async findAll(tenantId: string): Promise<IBranch[]> {
    return await tenantQuery.find(BranchModel, tenantId).sort({ createdAt: 1 }).exec();
  }

  public async findById(tenantId: string, branchId: string): Promise<IBranch | null> {
    return await tenantQuery.findOne(BranchModel, tenantId, { _id: branchId }).exec();
  }

  public async update(tenantId: string, branchId: string, data: UpdateBranchDto): Promise<IBranch | null> {
    return await tenantQuery.findOneAndUpdate(BranchModel, tenantId, { _id: branchId }, data, { new: true }).exec();
  }

  public async delete(tenantId: string, branchId: string): Promise<boolean> {
    const res = await tenantQuery.deleteOne(BranchModel, tenantId, { _id: branchId }).exec();
    return res.deletedCount > 0;
  }
}
