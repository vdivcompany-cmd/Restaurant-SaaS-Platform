import { z } from 'zod';

export const RegisterSuperAdminSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  phone: z.string().optional(),
});

export const RegisterOwnerSchema = z.object({
  tenantId: z.string().min(1, 'Tenant ID is required'),
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  phone: z.string().optional(),
});

export const RegisterStaffSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  phone: z.string().optional(),
  role: z.enum(['manager', 'cashier', 'kitchen'], {
    message: 'Staff role must be one of: manager, cashier, kitchen',
  }),
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

export const ForgotPasswordSchema = z.object({
  email: z.string().email(),
  tenantId: z.string().optional(),
  tenantSlug: z.string().optional(),
});

export const VerifyOtpSchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6, 'OTP must be 6 digits'),
  tenantId: z.string().optional(),
  tenantSlug: z.string().optional(),
});

export const ResetPasswordSchema = z.object({
  resetToken: z.string().min(1, 'Reset token is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters long'),
});

export type RegisterSuperAdminInput = z.infer<typeof RegisterSuperAdminSchema>;
export type RegisterOwnerInput = z.infer<typeof RegisterOwnerSchema>;
export type RegisterStaffInput = z.infer<typeof RegisterStaffSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type RefreshTokenInput = z.infer<typeof RefreshTokenSchema>;
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;
export type VerifyOtpInput = z.infer<typeof VerifyOtpSchema>;
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;
