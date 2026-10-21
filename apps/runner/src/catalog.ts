import { expect, type Page } from "@playwright/test";
import type { CheckId, Job } from "./schema.js";
import { checkAccessibility, QualityCheckError, validateCatalogue } from "./quality.js";
export async function runCheck(
  page: Page,
  check: CheckId,
  origin: string,
  environment: Job["environment"],
): Promise<void> {
  if (check === "api-contract") {
    // Page navigation keeps this read behind the existing network policy.
    const response = await page.goto(`${origin}/api/${environment}/products`, { timeout: 20000 });
    if (
      response?.status() !== 200 ||
      !response.headers()["content-type"]?.includes("application/json")
    )
      throw new QualityCheckError("Product API did not return HTTP 200 JSON");
    const body = await response.text();
    if (Buffer.byteLength(body) > 1024 * 1024)
      throw new QualityCheckError("Product API response exceeds 1 MiB");
    let value: unknown;
    try {
      value = JSON.parse(body);
    } catch {
      throw new QualityCheckError("Product API returned invalid JSON");
    }
    validateCatalogue(value);
    return;
  }
  const suffix = check === "product" ? "/products/everyday-shirt" : check === "cart" ? "/cart" : "";
  const response = await page.goto(`${origin}/${environment}${suffix}`, {
    waitUntil: "domcontentloaded",
    timeout: 20000,
  });
  expect(response?.status()).toBe(200);
  if (check === "accessibility") {
    await expect(page.getByRole("searchbox", { name: "Search products" })).toBeVisible();
    await checkAccessibility(page);
  } else if (check === "catalogue") {
    await expect(page.getByRole("searchbox", { name: "Search products" })).toBeVisible();
    await expect(page.locator(".product-photo")).toHaveCount(6);
  } else if (check === "product") {
    await expect(page.locator(".detail-info h1")).toBeVisible();
    await expect(page.getByRole("button", { name: "Add to cart", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "S", exact: true })).toBeEnabled();
  } else {
    await expect(page.getByText("Your cart is empty.", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Place demo order", exact: true }),
    ).toBeDisabled();
  }
}
