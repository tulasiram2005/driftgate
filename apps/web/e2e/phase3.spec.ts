import { createHmac, randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("automated matrix: queued run, authenticated live results and attempt history", async ({
  page,
  request,
}, testInfo) => {
  test.setTimeout(120000);
  const secret = process.env.RUNNER_CALLBACK_SECRET;
  test.skip(!secret, "A test-only callback secret is required for signed callback integration");
  await page.goto("/");
  await page.getByRole("button", { name: "Register", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("Automation QA");
  await page.getByLabel("Email", { exact: true }).fill(`automation-${randomUUID()}@example.test`);
  await page.getByLabel("Password", { exact: true }).fill("Automation-Test-Password!");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await page.getByRole("button", { name: "New project", exact: true }).click();
  await page.getByLabel("Project name").fill("Demo automation integration");
  await page.getByRole("button", { name: "Create project", exact: true }).click();
  await page.getByRole("button", { name: "Automated runs", exact: true }).click();
  await expect(page.getByText("No automated runs yet", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Start automated run", exact: true }).click();
  for (const check of ["snapshot", "api-contract", "accessibility"]) {
    await expect(page.getByRole("checkbox", { name: check, exact: true })).not.toBeChecked();
    await page.getByRole("checkbox", { name: check, exact: true }).check();
    await expect(page.getByRole("checkbox", { name: check, exact: true })).toBeChecked();
    await page.getByRole("checkbox", { name: check, exact: true }).uncheck();
  }
  const creation = page.waitForResponse(
    (response) =>
      response.url().endsWith("/automated-runs") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Queue run", exact: true }).click();
  const response = await creation;
  expect(response.status()).toBe(200);
  const run = (await response.json()).data;
  await expect(page.getByRole("heading", { name: "Run results", exact: true })).toBeVisible();
  await expect(page.locator(".qa-matrix-cell")).toHaveCount(3);
  async function callback(body: object) {
    const raw = JSON.stringify(body);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = createHmac("sha256", secret!).update(`${timestamp}.${raw}`).digest("hex");
    const result = await request.post(
      `${process.env.TEST_CALLBACK_BASE_URL ?? ""}/api/v1/runner/callback`,
      {
        data: raw,
        headers: {
          "Content-Type": "application/json",
          "X-Runner-Timestamp": timestamp,
          "X-Runner-Signature": `sha256=${signature}`,
        },
      },
    );
    expect(result.status(), await result.text()).toBe(200);
  }
  for (const checkId of ["catalogue", "product", "cart"]) {
    await callback({
      version: 1,
      eventId: randomUUID(),
      runId: run.id,
      type: "result",
      result: {
        checkId,
        browser: "chromium",
        device: "desktop",
        status: checkId === "product" ? "flaky" : "passed",
        attempts:
          checkId === "product"
            ? [
                {
                  attempt: 1,
                  status: "failed",
                  durationMs: 12,
                  error: "Synthetic callback fixture: first attempt",
                  evidence: [],
                },
                { attempt: 2, status: "passed", durationMs: 10, evidence: [] },
              ]
            : [{ attempt: 1, status: "passed", durationMs: 10, evidence: [] }],
      },
    });
  }
  await callback({
    version: 1,
    eventId: randomUUID(),
    runId: run.id,
    type: "completed",
    status: "flaky",
    resultCount: 3,
  });
  await expect(page.locator(".qa-run-summary")).toContainText("FLAKY");
  for (const width of [360, 768, 1280, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await expect
      .poll(
        async () =>
          (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze())
            .violations,
      )
      .toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(`matrix-${width}.png`), fullPage: true });
  }
  await page.locator(".qa-matrix-cell").filter({ hasText: "product" }).click();
  await expect(page.getByRole("dialog")).toContainText("Attempt 2");
  await expect(page.getByRole("dialog")).toContainText("Synthetic callback fixture");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "All automated runs" }).click();
  await expect(page.getByRole("heading", { name: "Threadline · STAGING" })).toBeVisible();
});
