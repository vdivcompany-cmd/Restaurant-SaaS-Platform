import { z } from 'zod';

export const RegisterSchema = z.object({
  tenantId: z.string().optional(),
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  phone: z.string().optional(),
  role: z.enum(['super_admin', 'owner', 'manager', 'cashier', 'kitchen']).default('owner'),
});

export const LoginSchema = z.object({
  tenantId: z.string().optional(),
  tenantSlug: z.string().optional(),
  email: z.string().email(),
  password: z.string().min(1, 'Password is required'),
});

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const ChangePasswordSchema = z.object({
  oldPassword: z.string().min(1, 'Old password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters long'),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type RefreshTokenInput = z.infer<typeof RefreshTokenSchema>;
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;
