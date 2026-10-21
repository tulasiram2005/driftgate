import assert from "node:assert/strict";
import test from "node:test";
import { parseProductMetadata, snapshotCatalogue } from "../src/snapshot.js";

const product = {
  id: "demo-shirt",
  slug: "demo-shirt",
  name: "Demo shirt",
  description: "Demo fixture",
  category: "shirts",
  priceCents: 1000,
  compareAtCents: null,
  image: "/shirt.png",
  imageAlt: "Demo shirt",
  featured: false,
  sizes: [{ label: "M", stock: 2 }],
};
const catalogue = (products: unknown[]) => JSON.stringify({ data: { products, flags: [] } });

test("snapshot accepts a valid demo catalogue without changing values", () => {
  assert.deepEqual(snapshotCatalogue(catalogue([product])), [product]);
});
test("snapshot rejects unsafe paths, duplicates and excessive products", () => {
  for (const slug of ["../admin", "//external.test", "shirt?token=x", "%2e%2e", "a".repeat(121)])
    assert.throws(() => snapshotCatalogue(catalogue([{ ...product, slug }])));
  assert.throws(() => snapshotCatalogue(catalogue([product, product])));
  assert.throws(() =>
    snapshotCatalogue(
      catalogue(
        Array.from({ length: 21 }, (_, i) => ({
          ...product,
          id: `demo-${i}`,
          slug: `demo-${i}`,
        })),
      ),
    ),
  );
});
test("snapshot rejects oversized and malformed catalogue bodies", () => {
  assert.throws(() => snapshotCatalogue(" ".repeat(1048577)));
  assert.throws(() => snapshotCatalogue("{"));
  assert.throws(() => snapshotCatalogue(catalogue([{ ...product, priceCents: -1 }])));
});
test("missing metadata stays missing; malformed metadata is not silently accepted", () => {
  assert.equal(parseProductMetadata(null), null);
  for (const raw of ["{", "{}", "[]", " ".repeat(32769)])
    assert.throws(() => parseProductMetadata(raw));
});
test("snapshot retains valid Product JSON-LD", () => {
  const metadata = {
    "@type": "Product",
    name: "Demo shirt",
    sku: "demo-shirt",
    offers: {
      "@type": "Offer",
      price: "10.00",
      priceCurrency: "INR",
      availability: "InStock",
      url: "/staging/products/demo-shirt",
    },
  };
  assert.deepEqual(parseProductMetadata(JSON.stringify(metadata)), metadata);
});
