import { z } from 'zod';
import { objectIdSchema } from '../../shared/validation/index.js';

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

/** Body for POST /menu/upload when sending a pre-structured JSON catalog. */
export const uploadJsonBodySchema = bulkImportSchema.extend({
  branchId: objectIdSchema.optional(),
});

/** Multer form-data fields (non-file) for POST /menu/upload with a file. */
export const uploadFileMetaSchema = z.object({
  branchId: objectIdSchema.optional(),
});

export type UploadJsonBody = z.infer<typeof uploadJsonBodySchema>;
export type UploadFileMeta = z.infer<typeof uploadFileMetaSchema>;

