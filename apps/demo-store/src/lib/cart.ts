import { z } from "zod";
import type { BugFlag } from "./flags";
import { StoreError } from "./errors";
import type { Product } from "./products";

const itemSchema = z
  .object({
    productId: z
      .string()
      .min(1)
      .max(64)
      .regex(/^[a-zA-Z0-9_-]+$/),
    size: z.string().min(1).max(20),
    quantity: z.number().int().min(1).max(10),
  })
  .strict();
export const cartSchema = z
  .object({
    items: z.array(itemSchema).max(20),
    coupons: z.array(z.enum(["WELCOME10", "SAVE20"])).max(2),
  })
  .strict();
export const checkoutSchema = cartSchema.extend({
  idempotencyKey: z
    .string()
    .min(8)
    .max(128)
    .regex(/^[a-zA-Z0-9_-]+$/),
});
export type Cart = z.infer<typeof cartSchema>;
export interface QuoteItem {
  productId: string;
  name: string;
  size: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
}
export interface Quote {
  items: QuoteItem[];
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
}

export function normalizeCart(cart: Cart): Cart {
  const items = new Map<string, Cart["items"][number]>();
  for (const item of cart.items) {
    const key = JSON.stringify([item.productId, item.size]);
    const quantity = (items.get(key)?.quantity ?? 0) + item.quantity;
    if (quantity > 10)
      throw new StoreError(400, "INVALID_CART", "At most ten of each product size are allowed.");
    items.set(key, { ...item, quantity });
  }
  return {
    items: [...items.values()].sort(
      (a, b) => a.productId.localeCompare(b.productId) || a.size.localeCompare(b.size),
    ),
    coupons: [...new Set(cart.coupons)].sort(),
  };
}

export function calculateQuote(input: Cart, products: Product[], flags: readonly BugFlag[]): Quote {
  const cart = normalizeCart(input);
  if (!cart.items.length)
    throw new StoreError(
      flags.includes("emptyCart500") ? 503 : 400,
      flags.includes("emptyCart500") ? "SIMULATED_EMPTY_CART_FAILURE" : "EMPTY_CART",
      "The cart is empty.",
    );
  if (cart.coupons.length > 1 && !flags.includes("couponStacking"))
    throw new StoreError(400, "COUPON_STACKING", "Only one coupon can be applied.");
  const items = cart.items.map((item): QuoteItem => {
    const product = products.find((p) => p.id === item.productId);
    if (!product || (flags.includes("missingProduct") && product.id === "bag"))
      throw new StoreError(404, "PRODUCT_NOT_FOUND", "Product not found.");
    const size = product.sizes.find((s) => s.label === item.size);
    if (!size) throw new StoreError(400, "INVALID_SIZE", "Unknown product size.");
    if (size.stock < item.quantity)
      throw new StoreError(409, "OUT_OF_STOCK", "Requested quantity is unavailable.");
    return {
      ...item,
      name: product.name,
      unitPriceCents: product.priceCents,
      lineTotalCents: product.priceCents * item.quantity,
    };
  });
  const subtotalCents = items.reduce((sum, item) => sum + item.lineTotalCents, 0);
  const percent = cart.coupons.reduce((sum, coupon) => sum + (coupon === "WELCOME10" ? 10 : 20), 0);
  const discountCents = Math.floor((subtotalCents * percent + 50) / 100);
  const taxable = subtotalCents - discountCents;
  // Round once at order level using integer basis points; the bug truncates instead.
  const taxCents = flags.includes("taxRounding")
    ? Math.floor((taxable * 825) / 10000)
    : Math.floor((taxable * 825 + 5000) / 10000);
  return { items, subtotalCents, discountCents, taxCents, totalCents: taxable + taxCents };
}
