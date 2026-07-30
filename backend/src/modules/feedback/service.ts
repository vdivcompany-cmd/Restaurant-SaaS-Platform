import { FeedbackRepository } from './repository.js';
import type { IFeedback } from './model.js';
import type { CreateFeedbackDto } from './validation.js';

export class FeedbackService {
  private repo = new FeedbackRepository();

  public async createFeedback(tenantId: string, dto: CreateFeedbackDto): Promise<IFeedback> {
    return await this.repo.create(tenantId, dto);
  }

  public async listFeedback(tenantId: string, branchId?: string): Promise<IFeedback[]> {
    return await this.repo.findAll(tenantId, branchId);
  }
}
