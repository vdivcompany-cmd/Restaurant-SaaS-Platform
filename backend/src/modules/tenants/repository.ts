import type { ClientSession } from 'mongoose';
import { TenantModel, type ITenant } from './model.js';

export class TenantRepository {
  public static async findBySlug(slug: string): Promise<ITenant | null> {
    return TenantModel.findOne({ slug: slug.toLowerCase() });
  }

  public static async findById(id: string): Promise<ITenant | null> {
    return TenantModel.findById(id);
  }

  public static async create(data: Partial<ITenant>, session?: ClientSession): Promise<ITenant> {
    if (session) {
      const [doc] = await TenantModel.create([data], { session });
      return doc as ITenant;
    }
    return TenantModel.create(data);
  }

  public static async save(tenant: ITenant): Promise<ITenant> {
    return tenant.save();
  }
}
