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
}
