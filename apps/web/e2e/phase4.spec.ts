import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("manual snapshots create a persisted comparison with safe rendered findings", async ({
  page,
}, testInfo) => {
  test.setTimeout(120000);
  await page.goto("/");
  await page.getByRole("button", { name: "Register", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("Comparison QA");
  await page.getByLabel("Email", { exact: true }).fill(`comparison-${randomUUID()}@example.test`);
  await page.getByLabel("Password", { exact: true }).fill("Comparison-Test-Password!");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await page.getByRole("button", { name: "New project", exact: true }).click();
  await page.getByLabel("Project name").fill("Demo comparison integration");
  await page.getByRole("button", { name: "Create project", exact: true }).click();
  await page.getByRole("button", { name: "Comparisons", exact: true }).click();
  for (const [environment, price] of [
    ["staging", 1000],
    ["uat", 1200],
  ] as const) {
    await page.getByRole("button", { name: "Import snapshot", exact: true }).click();
    await page.getByLabel("Snapshot label", { exact: true }).fill(`Demo ${environment}`);
    await page.getByLabel("Snapshot JSON", { exact: true }).fill(
      JSON.stringify({
        environment,
        origin: "http://127.0.0.1:3201",
        locale: "en-IN",
        productCount: 1,
        products: [
          {
            id: "demo-shirt",
            priceCents: price,
            compareAtCents: null,
            currency: "INR",
            sizes: [{ label: "M", stock: 1 }],
            discountPercent: null,
            badge: null,
            image: { status: 200, width: 900, height: 1125 },
            title: "Demo shirt",
            canonical: null,
            jsonLd: null,
          },
        ],
      }),
    );
    const response = page.waitForResponse(
      (r) => r.url().endsWith("/snapshots") && r.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Save snapshot", exact: true }).click();
    expect((await response).status()).toBe(200);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
  const before = page.getByLabel("Before snapshot", { exact: true });
  const after = page.getByLabel("After snapshot", { exact: true });
  await expect(before.locator("option").filter({ hasText: "Demo staging" })).toHaveCount(1);
  await before.selectOption(
    (await before
      .locator("option")
      .filter({ hasText: "Demo staging" })
      .getAttribute("value")) as string,
  );
  await after.selectOption(
    (await after.locator("option").filter({ hasText: "Demo uat" }).getAttribute("value")) as string,
  );
  const created = page.waitForResponse(
    (r) => r.url().endsWith("/comparisons") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Compare snapshots", exact: true }).click();
  const response = await created;
  expect(response.status()).toBe(200);
  expect((await response.json()).data.findings).toMatchObject([
    { field: "price", before: 1000, after: 1200, severity: "S1" },
  ]);
  const dialog = page.getByRole("dialog", { name: "Comparison findings" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("demo-shirt");
  for (const width of [360, 768, 1280, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(
      (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze())
        .violations,
    ).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath(`comparisons-${width}.png`),
      fullPage: true,
    });
  }
  await page.getByRole("button", { name: "Close dialog" }).click();
  await expect(page.getByRole("heading", { name: "Comparisons", exact: true })).toBeVisible();
});
