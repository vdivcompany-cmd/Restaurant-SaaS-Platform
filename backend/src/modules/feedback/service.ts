import { FeedbackRepository } from './repository.js';
import { BranchModel } from '../branches/model.js';
import { tenantQuery } from '../../utils/tenantQuery.js';
import type { IFeedback } from './model.js';
import type { CreateFeedbackDto } from './validation.js';

export class FeedbackService {
  private repo = new FeedbackRepository();

  public async createFeedback(tenantId: string, dto: CreateFeedbackDto): Promise<IFeedback> {
    let branchId = dto.branchId;
    if (!branchId) {
      const defaultBranch = await tenantQuery.findOne(BranchModel, tenantId, {}).exec();
      if (defaultBranch) {
        branchId = defaultBranch._id.toString();
      }
    }
    return await this.repo.create(tenantId, { ...dto, ...(branchId ? { branchId } : {}) });
  }

  public async listFeedback(tenantId: string, branchId?: string): Promise<IFeedback[]> {
    return await this.repo.findAll(tenantId, branchId);
  }
}
