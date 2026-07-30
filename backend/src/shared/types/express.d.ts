export type UserRole = 'super_admin' | 'owner' | 'manager' | 'cashier' | 'kitchen';

export interface AuthUser {
  id: string;
  tenantId?: string | undefined;
  role: UserRole;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      tenantId?: string;
      user?: AuthUser;
    }
  }
}
