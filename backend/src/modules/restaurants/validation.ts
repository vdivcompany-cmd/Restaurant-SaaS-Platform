import { z } from 'zod';

export const restaurantProfileSchema = z.object({
  brandName: z.string().min(2).max(100),
  cuisineType: z.string().max(50).optional().default('General'),
  description: z.string().max(500).optional(),
  logoUrl: z.string().url().optional(),
  currency: z.string().length(3).optional().default('EGP'),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().max(25).optional(),
});

export type RestaurantProfileDto = z.infer<typeof restaurantProfileSchema>;
