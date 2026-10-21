import { test } from "node:test";
import assert from "node:assert/strict";
import {
  compareEnvironments,
  type EnvironmentSnapshot,
  type ProductSnapshot,
  type ExpectedDifference,
} from "../src/drift.js";

function product(patch: Partial<ProductSnapshot> = {}): ProductSnapshot {
  return {
    id: "shirt",
    priceCents: 3999,
    compareAtCents: 4999,
    currency: "INR",
    sizes: [
      { label: "S", stock: 12 },
      { label: "M", stock: 8 },
      { label: "L", stock: 0 },
    ],
    discountPercent: 20,
    badge: "20% off",
    image: { status: 200, width: 900, height: 1125 },
    title: "Everyday T-Shirt | Threadline",
    canonical: "/products/everyday-shirt",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "Product",
      description: "Demo white cotton T-shirt.",
      image: "/products/shirt.jpg",
      name: "Everyday T-Shirt",
      sku: "shirt",
      offers: {
        "@type": "Offer",
        price: "39.99",
        priceCurrency: "INR",
        availability: "https://schema.org/InStock",
        url: "/products/everyday-shirt",
      },
    },
    ...patch,
  };
}
function snapshot(
  environment: EnvironmentSnapshot["environment"],
  products: readonly ProductSnapshot[] = [product()],
  patch: Partial<EnvironmentSnapshot> = {},
): EnvironmentSnapshot {
  return {
    environment,
    origin: `https://${environment}.threadline.test`,
    locale: "en-IN",
    productCount: products.length,
    products,
    ...patch,
  };
}
const baseline = () => snapshot("staging");
const compare = (patch: Partial<ProductSnapshot>) =>
  compareEnvironments(baseline(), snapshot("prod", [product(patch)]));

test("identical demo-shaped snapshots compare equal without mutation", () => {
  const a = baseline();
  const b = snapshot("prod");
  const saved = JSON.stringify([a, b]);
  assert.deepEqual(compareEnvironments(a, b), []);
  assert.equal(JSON.stringify([a, b]), saved);
});

test("normalizes currency casing, price grouping, decimals, whitespace and size order", () => {
  const a = snapshot("staging", [product({ priceCents: 12345678 })]);
  const b = snapshot("prod", [
    product({
      priceCents: "₹ 1,23,456.78",
      currency: " inr ",
      compareAtCents: "49.99 INR",
      title: " Everyday   T-Shirt | Threadline ",
      sizes: [
        { label: "l", stock: 0 },
        { label: " m ", stock: 8 },
        { label: "s", stock: 12 },
      ],
    }),
  ]);
  assert.deepEqual(compareEnvironments(a, b), []);
  for (const [currency, formatted] of [
    ["USD", "$1,234.50"],
    ["EUR", "€1,234.50"],
    ["GBP", "£1,234.50"],
  ]) {
    assert.deepEqual(
      compareEnvironments(
        snapshot("staging", [product({ currency, priceCents: 123450 })]),
        snapshot("prod", [product({ currency, priceCents: formatted! })], { locale: "en-US" }),
      ),
      [],
    );
  }
  assert.deepEqual(
    compareEnvironments(
      snapshot("staging", [product({ priceCents: 123450, currency: "EUR" })]),
      snapshot("prod", [product({ priceCents: "1.234,50 €", currency: "EUR" })], {
        locale: "de-DE",
      }),
    ),
    [],
  );
  assert.equal(compare({ priceCents: "39.9" })[0]?.after, 3990);
});

test("reports exact monetary changes as S1, without currency conversion", () => {
  for (const patch of [
    { priceCents: 4499 },
    { compareAtCents: null },
    { currency: "USD" },
    { discountPercent: 50 },
    { badge: "50% off" },
  ]) {
    const findings = compare(patch);
    assert.equal(findings.length, 1);
    assert.equal(findings[0]?.severity, "S1");
    assert.equal(findings[0]?.productId, "shirt");
    assert.equal(findings[0]?.expected, false);
  }
  assert.equal(compare({ priceCents: 4000 })[0]?.before, 3999);
  assert.equal(compare({ priceCents: 4000 })[0]?.after, 4000);
});

test("missing products in either direction and independent catalogue counts", () => {
  const a = baseline();
  const b = snapshot("prod", []);
  assert.deepEqual(
    compareEnvironments(a, b).map((f) => [f.field, f.severity, f.before, f.after]),
    [
      ["productCount", "S3", 1, 0],
      ["product", "S2", true, false],
    ],
  );
  assert.deepEqual(
    compareEnvironments(b, a).map((f) => [f.before, f.after]),
    [
      [0, 1],
      [false, true],
    ],
  );
  assert.deepEqual(
    compareEnvironments(a, snapshot("prod", [product()], { productCount: 10 })).map((f) => f.field),
    ["productCount"],
  );
});

test("distinguishes missing sizes, zero stock and changed quantities as S2", () => {
  const findings = compare({
    sizes: [
      { label: "S", stock: 11 },
      { label: "L", stock: 5 },
      { label: "XL", stock: 0 },
    ],
  });
  assert.deepEqual(
    findings.map((f) => [f.field, f.size, f.before, f.after, f.severity]),
    [
      ["stock", "L", 0, 5, "S2"],
      ["size", "M", true, false, "S2"],
      ["stock", "S", 12, 11, "S2"],
      ["size", "XL", false, true, "S2"],
    ],
  );
});

test("image status, absent observations, zero dimensions and SEO changes are S3", () => {
  const findings = compare({
    image: { status: 404, width: 0, height: null },
    title: null,
    canonical: "/prod/incorrect-product",
    jsonLd: null,
  });
  assert.deepEqual(
    findings.map((f) => f.field),
    ["image.status", "image.width", "image.height", "title", "canonical", "jsonLd"],
  );
  assert.ok(findings.every((f) => f.severity === "S3"));
  assert.equal(compare({ image: { status: null, width: 900, height: 1125 } })[0]?.after, null);
});

test("normalizes only each snapshot's own origin and exact environment route segment", () => {
  assert.deepEqual(
    compareEnvironments(
      snapshot("staging", [
        product({ canonical: "https://staging.threadline.test/staging/products/everyday-shirt" }),
      ]),
      snapshot("prod", [
        product({ canonical: "https://prod.threadline.test/prod/products/everyday-shirt" }),
      ]),
    ),
    [],
  );
  for (const canonical of [
    "https://evil.test/prod/products/everyday-shirt",
    "/staging/products/everyday-shirt",
    "/production/products/everyday-shirt",
    "/products/everyday-shirt?wrong=1",
  ]) {
    assert.equal(compare({ canonical })[0]?.field, "canonical");
  }
});

test("compares typed Product JSON-LD semantically and detects offer and identity changes", () => {
  const schema = product().jsonLd!;
  const withOffer = (offers: Partial<typeof schema.offers>) => ({
    ...schema,
    offers: { ...schema.offers, ...offers },
  });
  assert.deepEqual(
    compare({
      jsonLd: withOffer({
        price: "039.99",
        priceCurrency: "inr",
        url: "/prod/products/everyday-shirt",
      }),
    }),
    [],
  );
  for (const jsonLd of [
    withOffer({ price: "40.00" }),
    withOffer({ priceCurrency: "USD" }),
    withOffer({ availability: "https://schema.org/OutOfStock" }),
    withOffer({ url: "/wrong" }),
    { ...schema, name: "Wrong product" },
    { ...schema, sku: "wrong" },
  ]) {
    assert.equal(compare({ jsonLd })[0]?.field, "jsonLd");
  }
});

test("expected differences require exact field, product and environment pair", () => {
  const a = snapshot("staging", [product(), product({ id: "dress" })]);
  const b = snapshot("prod", [
    product({ priceCents: 4499, badge: "50% off" }),
    product({ id: "dress", priceCents: 4499 }),
  ]);
  const rule: ExpectedDifference = {
    field: "price",
    productId: "shirt",
    environments: ["prod", "staging"],
  };
  const findings = compareEnvironments(a, b, [rule]);
  assert.equal(findings.filter((f) => f.expected).length, 1);
  assert.equal(findings.find((f) => f.expected)?.productId, "shirt");
  assert.ok(
    compareEnvironments(a, b, [{ ...rule, environments: ["uat", "prod"] }]).every(
      (f) => !f.expected,
    ),
  );
  assert.equal(
    compareEnvironments(a, snapshot("prod", [], { productCount: 0 }), [
      { field: "productCount", productId: null, environments: ["staging", "prod"] },
    ]).filter((f) => f.expected).length,
    1,
  );
});

test("rejects ambiguous prices, invalid numbers, duplicates and unsupported input", () => {
  for (const priceCents of [
    NaN,
    Infinity,
    -1,
    1.5,
    Number.MAX_SAFE_INTEGER + 1,
    "",
    "1,23.45",
    "USD 39.99",
    "39.999",
    "1e3",
    "-1",
    "39.99junk",
  ]) {
    assert.throws(() => compare({ priceCents }));
  }
  for (const patch of [
    { currency: "JPY" },
    { discountPercent: 101 },
    { discountPercent: NaN },
    { sizes: [{ label: "M", stock: -1 }] },
    {
      sizes: [
        { label: "m", stock: 1 },
        { label: " M ", stock: 2 },
      ],
    },
    { image: { status: 600, width: 1, height: 1 } },
    { canonical: "javascript:alert(1)" },
  ]) {
    assert.throws(() => compare(patch));
  }
  assert.throws(() => compareEnvironments(baseline(), baseline()));
  assert.throws(() => compareEnvironments(baseline(), snapshot("prod", [product(), product()])));
});

test("bounds products, sizes, text and expected rules before comparison", () => {
  assert.throws(() =>
    compareEnvironments(
      baseline(),
      snapshot(
        "prod",
        Array.from({ length: 1001 }, (_, i) => product({ id: String(i) })),
      ),
    ),
  );
  assert.throws(() =>
    compare({ sizes: Array.from({ length: 101 }, (_, i) => ({ label: String(i), stock: 1 })) }),
  );
  assert.throws(() => compare({ title: "x".repeat(4097) }));
  assert.throws(() =>
    compareEnvironments(
      baseline(),
      snapshot("prod"),
      Array.from({ length: 1001 }, () => ({
        field: "price",
        productId: "shirt",
        environments: ["staging", "prod"],
      })),
    ),
  );
});

test("output is deterministic when product input order changes", () => {
  const a = snapshot("staging", [product({ id: "z" }), product({ id: "a" })]);
  const products = [product({ id: "a", priceCents: 1 }), product({ id: "z", priceCents: 2 })];
  assert.deepEqual(
    compareEnvironments(a, snapshot("prod", products)),
    compareEnvironments(
      { ...a, products: [...a.products].reverse() },
      snapshot("prod", [...products].reverse()),
    ),
  );
});
