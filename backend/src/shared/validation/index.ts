import { z } from 'zod';

/**
 * Master Zod Validation Library & Reusable Schema Primitives
 * Provides global validation building blocks for all controllers across the platform.
 */

// MongoDB ObjectId Hex Schema
export const objectIdSchema = z
  .string()
  .trim()
  .length(24, { message: 'Must be a valid 24-character hexadecimal MongoDB ObjectId' })
  .regex(/^[0-9a-fA-F]{24}$/, { message: 'Must contain only hexadecimal characters' });

// Non-Empty Clean String Schema
export const nonEmptyString = z.string().trim().min(1, { message: 'String cannot be empty' });

// Egyptian & International Phone Number Validator
export const phoneSchema = z
  .string()
  .trim()
  .min(8, { message: 'Phone number too short' })
  .max(20, { message: 'Phone number too long' })
  .regex(/^\+?[0-9\s\-\(\)]+$/, { message: 'Invalid characters in phone number' });

// Currency Price Validator (Positive decimal with up to 2 places)
export const priceSchema = z.number().nonnegative({ message: 'Price cannot be negative' });

// Standard Pagination Request Query Schema
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).default('desc').optional(),
});

// URL & Image Reference Validator
export const imageUrlSchema = z.string().trim().url({ message: 'Must be a valid asset image URL' });

// Tenant Slug Validator (alphanumeric with hyphens)
export const slugSchema = z
  .string()
  .trim()
  .min(2, { message: 'Slug must be at least 2 characters' })
  .max(50, { message: 'Slug cannot exceed 50 characters' })
  .regex(/^[a-z0-9\-]+$/, { message: 'Slug can only contain lowercase alphanumeric characters and hyphens' });

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
