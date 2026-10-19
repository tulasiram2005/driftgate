import { expect, type Page } from "@playwright/test";
import type { CheckId, Job } from "./schema.js";
export async function runCheck(
  page: Page,
  check: CheckId,
  origin: string,
  environment: Job["environment"],
): Promise<void> {
  const suffix = check === "product" ? "/products/everyday-shirt" : check === "cart" ? "/cart" : "";
  const response = await page.goto(`${origin}/${environment}${suffix}`, {
    waitUntil: "domcontentloaded",
    timeout: 20000,
  });
  expect(response?.status()).toBe(200);
  if (check === "catalogue") {
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
