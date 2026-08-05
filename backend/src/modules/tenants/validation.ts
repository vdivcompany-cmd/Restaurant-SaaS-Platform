import { z } from 'zod';

export const CreateTenantSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
  contact: z.object({
    phone: z.string().min(6),
    email: z.string().email(),
  }),
  settings: z.object({
    currency: z.string().default('EGP'),
    timezone: z.string().default('Africa/Cairo'),
    language: z.enum(['ar', 'en']).default('ar'),
  }).optional(),
});

export const UpdateTenantSettingsSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  contact: z.object({
    phone: z.string().min(6).optional(),
    email: z.string().email().optional(),
  }).optional(),
  settings: z.object({
    currency: z.string().optional(),
    timezone: z.string().optional(),
    language: z.enum(['ar', 'en']).optional(),
  }).optional(),
});

export const RestaurantProfileSchema = z.object({
  brandName: z.string().min(2).max(100).optional(),
  cuisineType: z.string().max(50).optional(),
  description: z.string().max(500).optional(),
  logoUrl: z.string().url().optional(),
  currency: z.string().length(3).optional(),
  qrRedirectUrl: z.string().url().optional(),
  isOpen: z.boolean().optional(),
  isChatbotActive: z.boolean().optional(),
  chatbotSettings: z.object({
    offlineMessage: z.string().max(300).optional(),
    aiModelPreference: z.string().max(50).optional(),
  }).optional(),
});

export type CreateTenantInput = z.infer<typeof CreateTenantSchema>;
export type UpdateTenantSettingsInput = z.infer<typeof UpdateTenantSettingsSchema>;
export type RestaurantProfileDto = z.infer<typeof RestaurantProfileSchema>;
