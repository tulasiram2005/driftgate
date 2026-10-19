import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

for (const width of [360, 768, 1280, 1920]) {
  test(`clean catalogue at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/staging");
    await expect(page.getByRole("textbox", { name: "Search products" })).toBeVisible();
    await expect(page.locator('.product-photo')).toHaveCount(6);
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.locator("img").evaluateAll(images => images.every(image => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0))).toBe(true);
    expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(`catalogue-${width}.png`), fullPage: true });
    await page.getByRole("textbox", { name: "Search products" }).fill("nothingmatchesxyz");
    await expect(page.locator('.product-photo')).toHaveCount(0);
    await page.getByRole("textbox", { name: "Search products" }).fill("");
    await expect(page.locator('.product-photo')).toHaveCount(6);
  });
}

test("environment API boundaries and deliberate flags", async ({ page }) => {
  await page.goto("/staging");
  const results = await page.evaluate(async () => {
    const output: { environment: string; status: number; body: { data: { flags: string[]; products?: unknown[] } } }[] = [];
    for (const environment of ["staging", "uat", "preprod", "prod"]) {
      const response = await fetch(`/api/${environment}/products`);
      output.push({ environment, status: response.status, body: await response.json() });
    }
    return output;
  });
  expect(results.map(result => result.status)).toEqual([200, 200, 200, 200]);
  expect(results[0]?.body.data.flags).toEqual([]);
  expect(results[0]?.body.data.products).toHaveLength(6);
  expect(results[3]?.body.data.products).toHaveLength(5);
  expect(new Set(results.flatMap(result => result.body.data.flags)).size).toBe(15);
  const statuses = await page.evaluate(async () => {
    const unknown = await fetch("/api/not-real/products");
    const invalid = await fetch("/api/staging/quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: [{ productId: "shirt", size: "M", quantity: -1 }], coupons: [] }) });
    return [unknown.status, invalid.status];
  });
  expect(statuses).toEqual([404, 400]);
});

test("product, cart, coupon and simulated checkout", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/staging/products/everyday-shirt");
  await expect(page.getByRole("button", { name: "Add to cart", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "S", exact: true }).click();
  await page.getByRole("button", { name: "Add to cart", exact: true }).click();
  await page.getByRole("link", { name: "View cart", exact: true }).click();
  await page.getByRole("textbox", { name: "Coupon code" }).fill("WELCOME10");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  const checkout = page.getByRole("button", { name: "Place demo order", exact: true });
  await expect(checkout).toBeEnabled();
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
  const responsePromise = page.waitForResponse(response => response.url().endsWith("/staging/checkout") && response.request().method() === "POST");
  await checkout.click();
  const response = await responsePromise;
  expect(response.status()).toBe(200);
  expect((await response.json()).data.status).toBe("SIMULATED");
  await expect(page.getByText("SIMULATED", { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("receipt.png"), fullPage: true });
  expect(errors).toEqual([]);
});
