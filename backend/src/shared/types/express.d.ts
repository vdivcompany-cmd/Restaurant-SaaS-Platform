export type UserRole = 'owner' | 'manager' | 'cashier' | 'kitchen';

export interface AuthUser {
  id: string;
  tenantId: string;
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
