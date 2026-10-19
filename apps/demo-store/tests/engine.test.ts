import { describe, expect, it } from "vitest";
import { calculateQuote, cartSchema, checkoutSchema } from "../src/lib/cart";
import { bugFlags, environments, getFlags, parseEnvironment, seedFlags } from "../src/lib/flags";
import { presentProducts, productSeeds } from "../src/lib/products";

const cart = { items: [{ productId: "shirt", size: "M", quantity: 1 }], coupons: [] };
describe("clean baseline and validation", () => {
  it("has six independent products and an unchanged clean projection", () => {
    expect(presentProducts(productSeeds, [])).toEqual(productSeeds);
    expect(productSeeds).toHaveLength(6);
    expect(getFlags("staging", "")).toEqual([]);
  });
  it("rounds tax once and computes canonical totals", () => {
    expect(calculateQuote(cart, productSeeds, [])).toMatchObject({
      subtotalCents: 3999,
      discountCents: 0,
      taxCents: 330,
      totalCents: 4329,
    });
    expect(calculateQuote({ ...cart, coupons: ["WELCOME10"] }, productSeeds, [])).toMatchObject({
      discountCents: 400,
      taxCents: 297,
      totalCents: 3896,
    });
  });
  it.each([0, -1, 1.5, 11, Number.MAX_SAFE_INTEGER])("rejects quantity %s", (quantity) => {
    expect(cartSchema.safeParse({ ...cart, items: [{ ...cart.items[0], quantity }] }).success).toBe(
      false,
    );
  });
  it("bounds rows, coupons, unknown fields and idempotency keys", () => {
    for (const invalid of [
      { ...cart, items: Array(21).fill(cart.items[0]) },
      { ...cart, totalCents: 1 },
      { ...cart, coupons: ["FAKE"] },
      { ...cart, items: [{ ...cart.items[0], priceCents: 1 }] },
    ])
      expect(cartSchema.safeParse(invalid).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...cart, idempotencyKey: "x" }).success).toBe(false);
  });
  it("aggregates duplicates before stock checks and bounds aggregate quantities", () => {
    expect(() =>
      calculateQuote(
        {
          ...cart,
          items: [
            { ...cart.items[0]!, quantity: 5 },
            { ...cart.items[0]!, quantity: 5 },
          ],
        },
        productSeeds,
        [],
      ),
    ).toThrow("unavailable");
    expect(() =>
      calculateQuote(
        {
          ...cart,
          items: [
            { ...cart.items[0]!, quantity: 6 },
            { ...cart.items[0]!, quantity: 6 },
          ],
        },
        productSeeds,
        [],
      ),
    ).toThrow("ten");
  });
  it("rejects missing product, missing size, empty cart and baseline coupon stacking", () => {
    expect(() => calculateQuote({ ...cart, items: [] }, productSeeds, [])).toThrow("empty");
    expect(() =>
      calculateQuote(
        { ...cart, items: [{ productId: "unknown", size: "M", quantity: 1 }] },
        productSeeds,
        [],
      ),
    ).toThrow("not found");
    expect(() =>
      calculateQuote(
        { ...cart, items: [{ productId: "shirt", size: "XXL", quantity: 1 }] },
        productSeeds,
        [],
      ),
    ).toThrow("Unknown");
    expect(() =>
      calculateQuote({ ...cart, coupons: ["WELCOME10", "SAVE20"] }, productSeeds, []),
    ).toThrow("Only one");
  });
});
describe("deterministic flags", () => {
  it("covers exactly 15 distinct seeds and keeps staging clean", () => {
    expect(new Set(Object.values(seedFlags).flat())).toEqual(new Set(bugFlags));
    for (const environment of environments)
      expect(getFlags(environment, "  ")).toEqual(seedFlags[environment]);
    expect(getFlags("prod", "none")).toEqual([]);
    expect(getFlags("staging", "taxRounding,taxRounding")).toEqual(["taxRounding"]);
  });
  it.each(["unknown", "none,taxRounding", "taxRounding,"])("rejects invalid override %s", (value) =>
    expect(() => getFlags("uat", value)).toThrow("unknown"),
  );
  it("rejects unknown environments", () =>
    expect(() => parseEnvironment("production")).toThrow("Unknown"));
});
describe("nine independent backend defects", () => {
  it("missingAlt clears only the shirt alt", () =>
    expect(
      presentProducts(productSeeds, ["missingAlt"]).find((p) => p.id === "shirt")?.imageAlt,
    ).toBe(""));
  it("missingProduct removes the backpack", () =>
    expect(presentProducts(productSeeds, ["missingProduct"]).map((p) => p.id)).not.toContain(
      "bag",
    ));
  it("priceMismatch changes display while quote uses canonical stored price", () => {
    expect(
      presentProducts(productSeeds, ["priceMismatch"]).find((p) => p.id === "shirt")?.priceCents,
    ).toBe(4499);
    expect(calculateQuote(cart, productSeeds, ["priceMismatch"]).items[0]?.unitPriceCents).toBe(
      3999,
    );
  });
  it("couponStacking permits 30 percent combined discount", () =>
    expect(
      calculateQuote({ ...cart, coupons: ["WELCOME10", "SAVE20"] }, productSeeds, [
        "couponStacking",
      ]).discountCents,
    ).toBe(1200));
  it("stockMismatch advertises unavailable size but still refuses purchase", () => {
    expect(
      presentProducts(productSeeds, ["stockMismatch"])
        .find((p) => p.id === "shirt")
        ?.sizes.find((s) => s.label === "L")?.stock,
    ).toBe(5);
    expect(() =>
      calculateQuote(
        { ...cart, items: [{ productId: "shirt", size: "L", quantity: 1 }] },
        productSeeds,
        ["stockMismatch"],
      ),
    ).toThrow("unavailable");
  });
  it("taxRounding loses one minor unit on a shirt", () =>
    expect(calculateQuote(cart, productSeeds, ["taxRounding"]).taxCents).toBe(329));
  it("emptyCart500 produces a controlled 503 within the agreed contract", () => {
    try {
      calculateQuote({ items: [], coupons: [] }, productSeeds, ["emptyCart500"]);
      throw new Error("Expected failure");
    } catch (error) {
      expect(error).toMatchObject({ status: 503, code: "SIMULATED_EMPTY_CART_FAILURE" });
    }
  });
  it("brokenImage changes only the jacket asset", () =>
    expect(
      presentProducts(productSeeds, ["brokenImage"]).find((p) => p.id === "jacket")?.image,
    ).toBe("/products/missing-jacket.jpg"));
  it("wrongProductTitle changes only dress display title", () =>
    expect(
      presentProducts(productSeeds, ["wrongProductTitle"]).find((p) => p.id === "dress")?.name,
    ).toBe("Utility Jacket"));
});
