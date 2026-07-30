import { UserModel, type IUser } from './model.js';
import { tenantQuery } from '../../utils/tenantQuery.js';

export class UserRepository {
  public static async findByEmail(tenantId: string, email: string): Promise<IUser | null> {
    return tenantQuery.findOne(UserModel, tenantId, { email: email.toLowerCase() });
  }

  public static async findById(tenantId: string, id: string): Promise<IUser | null> {
    return tenantQuery.findById(UserModel, tenantId, id);
  }

  public static async create(tenantId: string, data: Partial<IUser>): Promise<IUser> {
    return tenantQuery.create(UserModel, tenantId, data);
  }

  public static async save(user: IUser): Promise<IUser> {
    return user.save();
  }
}
