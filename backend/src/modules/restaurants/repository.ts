import { RestaurantModel, type IRestaurant } from './model.js';
import { tenantQuery } from '../../utils/tenantQuery.js';
import type { RestaurantProfileDto } from './validation.js';

export class RestaurantRepository {
  public async upsert(tenantId: string, data: RestaurantProfileDto): Promise<IRestaurant> {
    const existing = await tenantQuery.findOne(RestaurantModel, tenantId).exec();
    if (existing) {
      Object.assign(existing, data);
      return await existing.save();
    }
    return (await tenantQuery.create(RestaurantModel, tenantId, data)) as IRestaurant;
  }

  public async getByTenant(tenantId: string): Promise<IRestaurant | null> {
    return await tenantQuery.findOne(RestaurantModel, tenantId).exec();
  }
}
