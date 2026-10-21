import { test } from "node:test";
import assert from "node:assert/strict";
import { validateCatalogue } from "../src/quality.js";
import { parseJob } from "../src/schema.js";

const product = {
  id: "demo",
  slug: "demo",
  name: "Demo",
  description: "Demo fixture",
  category: "Tops",
  priceCents: 100,
  compareAtCents: null,
  image: "/demo.jpg",
  imageAlt: "Demo",
  featured: false,
  sizes: [{ label: "S", stock: 1 }],
};
test("catalogue contract accepts a valid response and rejects invalid stock, prices and duplicates", () => {
  const body = (products: unknown[]) => ({ data: { products, flags: [] } });
  assert.doesNotThrow(() => validateCatalogue(body([product])));
  for (const value of [
    null,
    {},
    body([]),
    body([product, product]),
    body([{ ...product, priceCents: -1 }]),
    body([{ ...product, priceCents: "100" }]),
    body([{ ...product, sizes: [{ label: "S", stock: -1 }] }]),
    body([{ ...product, sizes: [product.sizes[0], product.sizes[0]] }]),
  ])
    assert.throws(() => validateCatalogue(value));
});
test("new quality checks remain declarative and bounded", () => {
  const job = {
    version: 1,
    runId: "quality",
    environment: "staging",
    targetId: "threadline",
    checks: ["api-contract", "accessibility"],
    matrix: [{ browser: "chromium", device: "desktop" }],
    retries: 0,
  };
  assert.equal(parseJob(job).checks.length, 2);
  assert.throws(() => parseJob({ ...job, checks: ["api-contract", "api-contract"] }));
  assert.throws(() => parseJob({ ...job, script: "arbitrary" }));
});
