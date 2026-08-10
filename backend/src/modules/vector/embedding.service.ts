import type { IProductSubDoc } from '../menu/model.js';

/**
 * Build the text that gets embedded for a product.
 * Everything the chatbot might semantically match on: name, category,
 * description, variants (with options), price, availability.
 */
export function buildProductEmbeddingText(product: IProductSubDoc): string {
  const parts: string[] = [];

  parts.push(`Name: ${product.name}`);
  if (product.categoryName) parts.push(`Category: ${product.categoryName}`);
  if (product.description) parts.push(`Description: ${product.description}`);
  parts.push(`Price: ${product.basePrice}`);
  parts.push(`Available: ${product.isAvailable ? 'yes' : 'no'}`);

  if (product.variants && product.variants.length > 0) {
    const variantLines = product.variants.map((v) => {
      const opts = (v.options ?? [])
        .map((o) => `${o.name}${o.additionalPrice ? ` (+${o.additionalPrice})` : ''}`)
        .join(', ');
      return `${v.name}: ${opts || 'no options'}`;
    });
    parts.push(`Variants: ${variantLines.join(' | ')}`);
  }

  return parts.join('\n');
}

/**
 * Metadata attached to each vector so the retriever can filter/return
 * enough for the chatbot without hitting Mongo again.
 */
export function buildProductMetadata(tenantId: string, product: IProductSubDoc, menuId?: string): Record<string, unknown> {
  const metadata: Record<string, unknown> = {
    tenantId,
    productId: product._id.toString(),
    name: product.name,
    categoryId: product.categoryId?.toString(),
    categoryName: product.categoryName,
    basePrice: product.basePrice,
    isAvailable: product.isAvailable,
    updatedAt: product.updatedAt?.toISOString?.() ?? new Date().toISOString(),
    variants: (product.variants || []).map((v: any) => ({
      variantId: v._id?.toString(),
      name: v.name,
      minSelect: v.minSelect,
      maxSelect: v.maxSelect,
      options: (v.options || []).map((o: any) => ({
        name: o.name,
        priceDelta: o.price ?? o.additionalPrice ?? 0,
      })),
    })),
  };
  if (menuId) {
    metadata.menuId = menuId;
  }
  return metadata;
}
