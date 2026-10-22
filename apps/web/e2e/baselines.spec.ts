import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

for (const decision of ["APPROVED", "REJECTED"] as const) {
  test(`baseline review screen handles ${decision} demo candidate`, async ({ page }, info) => {
    test.setTimeout(120000);
    const row = {
      id: "demo-baseline",
      label: "Demo catalogue",
      environment: "STAGING",
      browser: "chromium",
      device: "desktop",
      viewportWidth: 1280,
      viewportHeight: 900,
      status: "PENDING",
      active: false,
      reviewedBy: null,
      reviewedAt: null,
      reviewComment: null,
      evidence: {
        id: "demo-evidence",
        kind: "screenshot",
        ready: true,
        sizeBytes: 100,
        resultId: "demo-result",
        result: { runId: "demo-run" },
      },
    };
    await page.route("**/api/v1/projects/*/visual-baselines?*", (route) =>
      route.fulfill({ json: { data: [row], nextCursor: null } }),
    );
    await page.route("**/api/v1/projects/*/visual-comparisons?*", (route) =>
      route.fulfill({
        json: {
          data: [
            {
              id: "demo-comparison",
              changedPixels: 42,
              comparedPixels: 1000,
              createdAt: "2026-10-23T00:00:00Z",
              baseline: {
                label: "Demo previous comparison",
                environment: "STAGING",
                browser: "chromium",
              },
            },
          ],
          nextCursor: null,
        },
      }),
    );
    await page.route("**/api/v1/projects/*/visual-comparisons/demo-comparison/url", (route) =>
      route.fulfill({ json: { data: { url: "https://evidence.example.test/diff.png" } } }),
    );
    await page.route("https://evidence.example.test/diff.png", (route) =>
      route.fulfill({
        contentType: "image/png",
        body: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4AWP4DwQACfsD/c8LaHIAAAAASUVORK5CYII=",
          "base64",
        ),
      }),
    );
    await page.route(
      "**/api/v1/projects/*/visual-baselines/demo-baseline/review",
      async (route) => {
        expect(route.request().postDataJSON()).toEqual({
          status: decision,
          comment: "Demo layout needs review",
        });
        row.status = decision;
        await route.fulfill({ json: { data: row } });
      },
    );
    await page.route(
      "**/api/v1/projects/*/visual-baselines/demo-baseline/activate",
      async (route) => {
        expect(route.request().postDataJSON()).toEqual({});
        row.active = true;
        await route.fulfill({ json: { data: row } });
      },
    );
    await page.goto("/");
    await page.getByRole("button", { name: "Register", exact: true }).click();
    await page.getByLabel("Name", { exact: true }).fill("Demo reviewer");
    await page.getByLabel("Email", { exact: true }).fill(`baseline-${randomUUID()}@example.test`);
    await page.getByLabel("Password", { exact: true }).fill("Baseline-Test-Password!");
    await page.getByRole("button", { name: "Create account", exact: true }).click();
    await page.getByRole("button", { name: "New project", exact: true }).click();
    await page.getByLabel("Project name").fill("Demo baseline review");
    await page.getByRole("button", { name: "Create project", exact: true }).click();
    await page.getByRole("button", { name: "Visual baselines", exact: true }).click();
    await expect(page.getByText("42 changed pixels (4.20%)", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Get difference image", exact: true }).click();
    await expect(page.getByRole("link", { name: "Download difference PNG" })).toBeVisible();
    const difference = page.getByAltText(
      "Changed pixels highlighted against a transparent background",
    );
    await expect(difference).toBeVisible();
    await expect
      .poll(() => difference.evaluate((image: HTMLImageElement) => image.naturalWidth))
      .toBe(1);
    for (const width of [360, 768, 1280, 1920]) {
      await page.setViewportSize({ width, height: 1000 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      expect(
        (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze())
          .violations,
      ).toEqual([]);
      await page.screenshot({ path: info.outputPath(`comparisons-${width}.png`), fullPage: true });
    }
    await page.getByRole("button", { name: "Inspect baseline", exact: true }).click();
    for (const width of [360, 768, 1280, 1920]) {
      await page.setViewportSize({ width, height: 1000 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      expect(
        (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze())
          .violations,
      ).toEqual([]);
      await page.screenshot({ path: info.outputPath(`baseline-${width}.png`), fullPage: true });
    }
    await page.getByLabel("Decision", { exact: true }).selectOption(decision);
    await page.getByLabel("Review comment", { exact: true }).fill("Demo layout needs review");
    await page.getByRole("button", { name: "Save decision", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByText(decision, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Inspect baseline", exact: true }).click();
    if (decision === "APPROVED") {
      await page.getByRole("button", { name: "Use as active baseline", exact: true }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(page.getByText("APPROVED · Active", { exact: true })).toBeVisible();
    } else {
      await expect(
        page.getByRole("button", { name: "Use as active baseline", exact: true }),
      ).toHaveCount(0);
    }
  });
}
