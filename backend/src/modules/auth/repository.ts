import { UserModel, type IUser } from './model.js';
import { tenantQuery } from '../../utils/tenantQuery.js';

export class UserRepository {
  public static async findByEmail(tenantId: string, email: string): Promise<IUser | null> {
    return tenantQuery.findOne(UserModel, tenantId, { email: email.toLowerCase() });
  }

  public static async findSuperAdminByEmail(email: string): Promise<IUser | null> {
    return UserModel.findOne({ email: email.toLowerCase(), role: 'super_admin' });
  }

  public static async findById(tenantId: string, id: string): Promise<IUser | null> {
    return tenantQuery.findById(UserModel, tenantId, id);
  }

  public static async create(tenantId: string | null | undefined, data: Partial<IUser>): Promise<IUser> {
    if (data.role === 'super_admin') {
      return UserModel.create({ ...data, tenantId: tenantId || null });
    }
    return tenantQuery.create(UserModel, tenantId as string, data);
  }

  public static async findByEmailAcrossTenants(email: string): Promise<IUser | null> {
    return UserModel.findOne({ email: email.toLowerCase() });
  }

  public static async findByIdGlobal(id: string): Promise<IUser | null> {
    return UserModel.findById(id);
  }

  public static async save(user: IUser): Promise<IUser> {
    return user.save();
  }
}
