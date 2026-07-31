import { RestaurantRepository } from './repository.js';
import type { IRestaurant } from './model.js';
import type { RestaurantProfileDto } from './validation.js';
import { AppError } from '../../middleware/errorHandler.middleware.js';

export class RestaurantService {
  private repo = new RestaurantRepository();

  public async upsertProfile(tenantId: string, dto: RestaurantProfileDto): Promise<IRestaurant> {
    return await this.repo.upsert(tenantId, dto);
  }

  public async getProfile(tenantId: string): Promise<IRestaurant> {
    const profile = await this.repo.getByTenant(tenantId);
    if (!profile) throw new AppError('Restaurant profile not found', 404);
    return profile;
  }

  public async getAiStatus(tenantId: string) {
    const profile = await this.repo.getByTenant(tenantId);
    if (!profile) throw new AppError('Restaurant profile not found for this tenant', 404);

    const isOpen = profile.isOpen !== false;
    const isChatbotActive = profile.isChatbotActive !== false;
    const canAnswer = isOpen && isChatbotActive;
    const offlineReply = profile.chatbotSettings?.offlineMessage || 'We are currently closed for orders or our chatbot is on a break. Please check back during operating hours!';

    return {
      tenantId,
      brandName: profile.brandName,
      currency: profile.currency,
      isOpen,
      isChatbotActive,
      canAnswer,
      offlineReply: canAnswer ? null : offlineReply,
      aiModelPreference: profile.chatbotSettings?.aiModelPreference || 'gpt-4o',
    };
  }
}
