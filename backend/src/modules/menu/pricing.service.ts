import { MenuRepository } from './repository.js';
import { AppError } from '../../middleware/errorHandler.middleware.js';

export interface PricedOrderItemInput {
  productId: string;
  quantity: number;
  variantId?: string;
  selectedOptionNames?: string[];
  notes?: string;
}

export interface PricedOrderItem {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  selectedVariants: Array<{
    variantId?: string;
    variantName?: string;
    selectedOptionNames?: string[];
    priceDelta: number;
  }>;
  notes?: string;
}

export interface PricedOrder {
  items: PricedOrderItem[];
  subtotal: number;
  totalAmount: number;
}

const menuRepo = new MenuRepository();

/**
 * Authoritative, server-side price calculation. Never trusts client-supplied
 * prices. Looks up each product (and, if given, a matching variant/option) in
 * MenuModel.products and computes unitPrice = basePrice + sum(selected option
 * priceDeltas). Throws 400/404 on unknown or unavailable products/variants.
 */
export async function priceOrderItems(
  tenantId: string,
  rawItems: PricedOrderItemInput[]
): Promise<PricedOrder> {
  const items: PricedOrderItem[] = [];

  for (const raw of rawItems) {
    const product = await menuRepo.findProductById(tenantId, raw.productId);
    if (!product) {
      throw new AppError(`Product ${raw.productId} not found or out of scope`, 404);
    }
    if (product.isAvailable === false) {
      throw new AppError(`"${product.name}" is currently unavailable`, 400);
    }

    let priceDelta = 0;
    const selectedVariants: PricedOrderItem['selectedVariants'] = [];

    if (raw.variantId) {
      const variant = (product.variants || []).find(
        (v: any) => v._id?.toString() === raw.variantId
      );
      if (!variant) {
        throw new AppError(`Variant ${raw.variantId} not found on product "${product.name}"`, 404);
      }

      const chosenNames = raw.selectedOptionNames?.length
        ? raw.selectedOptionNames
        : [];
      const chosenOptions = (variant.options || []).filter((o: any) =>
        chosenNames.includes(o.name)
      );

      if (variant.minSelect > 0 && chosenOptions.length < variant.minSelect) {
        throw new AppError(
          `Variant "${variant.name}" requires at least ${variant.minSelect} selection(s)`,
          400
        );
      }
      if (chosenOptions.length > variant.maxSelect) {
        throw new AppError(
          `Variant "${variant.name}" allows at most ${variant.maxSelect} selection(s)`,
          400
        );
      }

      priceDelta = chosenOptions.reduce(
        (sum: number, o: any) => sum + (o.price ?? o.additionalPrice ?? 0),
        0
      );

      selectedVariants.push({
        variantId: raw.variantId,
        variantName: variant.name,
        selectedOptionNames: chosenNames,
        priceDelta,
      });
    }

    const unitPrice = Number((product.basePrice + priceDelta).toFixed(2));
    const totalPrice = Number((unitPrice * raw.quantity).toFixed(2));

    items.push({
      productId: raw.productId,
      name: product.name,
      quantity: raw.quantity,
      unitPrice,
      totalPrice,
      selectedVariants,
      ...(raw.notes ? { notes: raw.notes } : {}),
    });
  }

  const subtotal = Number(items.reduce((s, i) => s + i.totalPrice, 0).toFixed(2));

  return { items, subtotal, totalAmount: subtotal };
}
