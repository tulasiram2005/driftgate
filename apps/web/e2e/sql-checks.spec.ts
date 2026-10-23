import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("SQL result history displays demo failures and unavailable checks", async ({ page }, info) => {
  test.setTimeout(120000);
  const rows: object[] = [];
  await page.route("**/api/v1/projects/*/sql-checks?*", (route) =>
    route.fulfill({ json: { data: rows, nextCursor: null } }),
  );
  await page.route("**/api/v1/projects/*/sql-checks", async (route) => {
    expect(route.request().method()).toBe("POST");
    expect(route.request().postDataJSON()).toEqual({ environment: "staging" });
    const data = {
      id: `demo-sql-${rows.length}`,
      environment: "staging",
      status: rows.length ? "ERROR" : "FAIL",
      durationMs: 15,
      createdAt: "2026-10-23T00:00:00Z",
      errorCode: rows.length ? "SQL_CHECK_UNAVAILABLE" : null,
      results: rows.length
        ? []
        : [
            { check: "nonnegative-stock", status: "PASS", violations: 0 },
            { check: "order-totals", status: "FAIL", violations: 1 },
            { check: "orphan-order-items", status: "FAIL", violations: 1 },
          ],
    };
    rows.unshift(data);
    await route.fulfill({ json: { data } });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Register", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("Demo SQL reviewer");
  await page.getByLabel("Email", { exact: true }).fill(`sql-ui-${randomUUID()}@example.test`);
  await page.getByLabel("Password", { exact: true }).fill("Baseline-Test-Password!");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await page.getByRole("button", { name: "New project", exact: true }).click();
  await page.getByLabel("Project name").fill("Demo SQL review");
  await page.getByRole("button", { name: "Create project", exact: true }).click();
  await page.getByRole("button", { name: "SQL checks", exact: true }).click();
  await expect(page.getByText("No SQL results", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Run SQL checks", exact: true }).click();
  await expect(page.getByText("STAGING · FAIL", { exact: true })).toBeVisible();
  await expect(page.getByText("Order totals: FAIL · 1 violations", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Run SQL checks", exact: true }).click();
  await expect(page.getByText("STAGING · ERROR", { exact: true })).toBeVisible();
  for (const width of [360, 768, 1280, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(
      (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze())
        .violations,
    ).toEqual([]);
    await page.screenshot({ path: info.outputPath(`sql-results-${width}.png`), fullPage: true });
  }
  await page.getByRole("button", { name: "Visual baselines", exact: true }).click();
  await page.getByRole("button", { name: "SQL checks", exact: true }).click();
  await expect(page.getByText("STAGING · FAIL", { exact: true })).toBeVisible();
});
