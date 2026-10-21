import AxeBuilder from "@axe-core/playwright";
import { z } from "zod";
import type { Page } from "@playwright/test";

export class QualityCheckError extends Error {}

const product = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  category: z.string().min(1),
  priceCents: z.number().int().nonnegative().safe(),
  compareAtCents: z.number().int().nonnegative().safe().nullable(),
  image: z.string().min(1),
  imageAlt: z.string(),
  featured: z.boolean(),
  sizes: z
    .array(z.object({ label: z.string().min(1), stock: z.number().int().nonnegative().safe() }))
    .min(1)
    .max(100),
});
export const catalogueContract = z.object({
  data: z.object({
    products: z.array(product).min(1).max(1000),
    flags: z.array(z.string()).max(100),
  }),
});

export function validateCatalogue(value: unknown): void {
  const parsed = catalogueContract.safeParse(value);
  if (!parsed.success)
    throw new QualityCheckError("Product API response violates the catalogue contract");
  const products = parsed.data.data.products;
  if (
    new Set(products.map((p) => p.id)).size !== products.length ||
    new Set(products.map((p) => p.slug)).size !== products.length ||
    products.some((p) => new Set(p.sizes.map((s) => s.label)).size !== p.sizes.length)
  )
    throw new QualityCheckError("Product API contains duplicate identities");
}

export async function checkAccessibility(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  if (results.violations.length) {
    // Rule IDs, not DOM snippets, are safe to persist in run diagnostics.
    const rules = results.violations
      .map((v) => v.id)
      .sort()
      .join(", ");
    throw new QualityCheckError(`WCAG violations (${results.violations.length}): ${rules}`);
  }
}
