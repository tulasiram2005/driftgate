/// <reference lib="dom" />
import { z } from "zod";
import type { Page, Response } from "@playwright/test";
import type { Environment, EnvironmentSnapshot, ProductSnapshot } from "./drift.js";
import { catalogueContract, validateCatalogue } from "./quality.js";

const boundedText = z.string().max(4096);
const jsonLd = z.object({
  "@context": boundedText.optional(),
  "@type": z.literal("Product"),
  name: boundedText,
  description: boundedText.optional(),
  image: boundedText.optional(),
  sku: boundedText,
  offers: z.object({
    "@type": z.literal("Offer"),
    price: boundedText,
    priceCurrency: boundedText,
    availability: boundedText,
    url: boundedText,
  }),
});

export function parseProductMetadata(raw: string | null): ProductSnapshot["jsonLd"] {
  if (raw === null) return null;
  if (Buffer.byteLength(raw) > 32768) throw new Error("Product metadata exceeds limit");
  const parsed = jsonLd.parse(JSON.parse(raw));
  return {
    "@type": parsed["@type"],
    name: parsed.name,
    sku: parsed.sku,
    offers: parsed.offers,
    ...(parsed["@context"] === undefined ? {} : { "@context": parsed["@context"] }),
    ...(parsed.description === undefined ? {} : { description: parsed.description }),
    ...(parsed.image === undefined ? {} : { image: parsed.image }),
  };
}

export function snapshotCatalogue(raw: string) {
  if (Buffer.byteLength(raw) > 1048576) throw new Error("Catalogue exceeds snapshot limit");
  const value: unknown = JSON.parse(raw);
  validateCatalogue(value);
  const products = catalogueContract.parse(value).data.products;
  // Fail instead of silently truncating a comparison and reporting products missing.
  if (products.length > 20) throw new Error("Snapshot supports at most 20 products");
  if (products.some((p) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.slug) || p.slug.length > 120))
    throw new Error("Invalid snapshot product path");
  return products;
}

/** Internal collector only: caller must supply the runner's network-restricted page.
 * It does not create a context, use APIRequestContext, or relax route interception.
 */
export async function collectThreadlineSnapshot(
  page: Page,
  environment: Environment,
): Promise<EnvironmentSnapshot> {
  if (!["staging", "uat", "preprod", "prod"].includes(environment))
    throw new Error("Invalid snapshot environment");
  const origin = "http://127.0.0.1:3201";
  const navigate = async (path: string) => {
    const url = `${origin}${path}`;
    const response = await page.goto(url, { waitUntil: "load", timeout: 10000 });
    if (
      !response ||
      response.status() !== 200 ||
      page.url() !== url ||
      response.request().redirectedFrom()
    )
      throw new Error("Snapshot navigation failed");
    return response;
  };
  const response = await navigate(`/api/${environment}/products`);
  if (!response.headers()["content-type"]?.includes("application/json"))
    throw new Error("Snapshot catalogue must be JSON");
  const catalogue = snapshotCatalogue(await response.text());
  const products: ProductSnapshot[] = [];
  for (const product of catalogue) {
    const imageStatuses = new Map<string, number>();
    const observe = (resource: Response) => {
      if (resource.request().resourceType() === "image" && imageStatuses.size < 120)
        imageStatuses.set(resource.url(), resource.status());
    };
    page.on("response", observe);
    try {
      await navigate(`/${environment}/products/${product.slug}`);
      await page.locator(".detail-info h1").waitFor({ timeout: 10000 });
      await page.waitForFunction(
        () => {
          const image = document.querySelector<HTMLImageElement>(".detail-photo img");
          return image?.complete;
        },
        undefined,
        { timeout: 10000 },
      );
      const observed = await page.evaluate(() => {
        const image = document.querySelector<HTMLImageElement>(".detail-photo img");
        const scripts = document.querySelectorAll('script[type="application/ld+json"]');
        const text = (selector: string) =>
          document.querySelector(selector)?.textContent?.trim() ?? null;
        return {
          price: text(".detail-price > span"),
          compareAt: text(".detail-price del"),
          badge: text(".sale-text"),
          title: document.title,
          canonical: document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href ?? null,
          metadata: scripts.length === 1 ? (scripts[0]?.textContent ?? null) : null,
          metadataCount: scripts.length,
          imageUrl: image?.currentSrc ?? "",
          width: image?.naturalWidth ?? null,
          height: image?.naturalHeight ?? null,
        };
      });
      if (!observed.price || observed.metadataCount > 1)
        throw new Error("Ambiguous product snapshot");
      for (const value of [
        observed.price,
        observed.compareAt,
        observed.badge,
        observed.title,
        observed.canonical,
      ])
        if (value !== null && value.length > 4096) throw new Error("Snapshot text exceeds limit");
      const discount = observed.badge?.match(/^(\d+(?:\.\d+)?)% off$/);
      const discountPercent = discount ? Number(discount[1]) : null;
      if (discountPercent !== null && discountPercent > 100)
        throw new Error("Invalid discount badge");
      products.push({
        id: product.id,
        priceCents: observed.price,
        compareAtCents: observed.compareAt,
        currency: "INR",
        sizes: product.sizes,
        discountPercent,
        badge: observed.badge,
        image: {
          status: imageStatuses.get(observed.imageUrl) ?? null,
          width: observed.width,
          height: observed.height,
        },
        title: observed.title,
        canonical: observed.canonical,
        jsonLd: parseProductMetadata(observed.metadata),
      });
    } finally {
      page.off("response", observe);
    }
  }
  return { environment, origin, locale: "en-IN", productCount: catalogue.length, products };
}
