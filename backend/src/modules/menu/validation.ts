import { z } from 'zod';

export const variantOptionSchema = z.object({
  name: z.string().min(1, 'Option name is required'),
  priceDelta: z.number().default(0),
  isDefault: z.boolean().default(false),
});

export const variantSchema = z.object({
  name: z.string().min(1, 'Variant name is required'),
  minSelect: z.number().min(0).default(0),
  maxSelect: z.number().min(1).default(1),
  options: z.array(variantOptionSchema).min(1, 'Variant must have at least one option'),
});

export const productSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  description: z.string().optional(),
  basePrice: z.number().min(0, 'Base price must be non-negative'),
  imageUrl: z.string().url().optional().or(z.string().length(0)),
  variants: z.array(variantSchema).default([]),
});

export const categorySchema = z.object({
  name: z.string().min(1, 'Category name is required'),
  displayOrder: z.number().default(0),
  products: z.array(productSchema).min(1, 'Category must contain at least one product'),
});

export const bulkImportSchema = z.object({
  categories: z.array(categorySchema).min(1, 'At least one category is required for bulk import'),
});

export const singleProductSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  description: z.string().optional(),
  basePrice: z.number().min(0, 'Base price must be non-negative'),
  imageUrl: z.string().url().optional().or(z.string().length(0)),
  variants: z.array(variantSchema).optional().default([]),
  categoryId: z.string().optional(),
});

export type BulkImportPayload = z.infer<typeof bulkImportSchema>;
export type SingleProductInput = z.infer<typeof singleProductSchema>;

