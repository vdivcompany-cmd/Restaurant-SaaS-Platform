import { FeedbackModel, type IFeedback } from './model.js';
import { tenantQuery } from '../../utils/tenantQuery.js';
import type { CreateFeedbackDto } from './validation.js';

export class FeedbackRepository {
  public async create(tenantId: string, data: CreateFeedbackDto): Promise<IFeedback> {
    return (await tenantQuery.create(FeedbackModel, tenantId, data)) as IFeedback;
  }

  public async findAll(tenantId: string, branchId?: string): Promise<IFeedback[]> {
    const filter: Record<string, unknown> = {};
    if (branchId) filter['branchId'] = branchId;
    return await tenantQuery.find(FeedbackModel, tenantId, filter).sort({ createdAt: -1 }).exec();
  }
}
