import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("real API: failed result creates a defect with persisted status history", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const registered = await page.request.post("/api/v1/auth/register", {
    data: {
      name: "Demo defect reviewer",
      email: `defects-${randomUUID()}@example.test`,
      password: "Defects-Test-Password!",
    },
  });
  expect(registered.ok()).toBe(true);
  const headers = { Authorization: `Bearer ${(await registered.json()).data.accessToken}` };
  async function post(path: string, data: object) {
    const response = await page.request.post(`/api/v1${path}`, { headers, data });
    expect(response.ok()).toBe(true);
    return (await response.json()).data;
  }
  const project = await post("/projects", { name: "Demo defect review" });
  const base = `/projects/${project.id}`;
  const testCase = await post(`${base}/cases`, {
    title: "Demo checkout total",
    priority: "HIGH",
    type: "MANUAL",
    steps: [{ action: "Complete checkout", expected: "Correct total" }],
  });
  const suite = await post(`${base}/suites`, {
    name: "Demo checkout suite",
    caseIds: [testCase.id],
  });
  const run = await post(`${base}/runs`, {
    suiteId: suite.id,
    environment: "UAT",
    browser: "Chromium",
    device: "Desktop",
  });
  const saved = await page.request.put(
    `/api/v1${base}/runs/${run.id}/results/${run.results[0].id}`,
    {
      headers,
      data: { status: "FAIL", notes: "Demo total mismatch" },
    },
  );
  expect(saved.ok()).toBe(true);
  await page.goto("/");
  await page.getByLabel("Current project").selectOption(project.id);
  await page.getByRole("button", { name: "Manual runs", exact: true }).click();
  await page.getByRole("button", { name: "Open run", exact: true }).click();
  await page.getByLabel("Defect severity").selectOption("S1");
  await page.getByRole("button", { name: "Create defect", exact: true }).click();
  await expect(page.getByText("Defect saved: S1 · NEW", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Defects", exact: true }).click();
  await expect(page.getByRole("region", { name: "Project-wide defect metrics" })).toBeVisible();
  await expect(page.getByText("Mean time to closure", { exact: true })).toBeVisible();
  await page.getByLabel("Filter severity").selectOption("S4");
  await expect(page.getByRole("heading", { name: "No matching defects" })).toBeVisible();
  await page.getByRole("button", { name: "Clear filters", exact: true }).click();
  await page.getByLabel("Search defects").fill("checkout");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  for (const width of [360, 768, 1280, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(
      (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze())
        .violations,
    ).toEqual([]);
    await page.screenshot({ path: info.outputPath(`defect-metrics-${width}.png`), fullPage: true });
  }
  await page.getByRole("button", { name: "Demo checkout total", exact: true }).click();
  await expect(page.getByText("Demo total mismatch", { exact: true })).toBeVisible();
  await expect(page.getByText("Expected: Correct total", { exact: true })).toBeVisible();
  await page.getByLabel("Change comment").fill("Demo triage confirmed");
  await page.getByRole("button", { name: "Update status", exact: true }).click();
  await expect(page.getByText("Demo triage confirmed", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Next status")).toHaveValue("IN_PROGRESS");
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [360, 768, 1280, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(
      (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze())
        .violations,
    ).toEqual([]);
    await page.screenshot({ path: info.outputPath(`defect-${width}.png`), fullPage: true });
  }
  await page.reload();
  await page.getByLabel("Current project").selectOption(project.id);
  await page.getByRole("button", { name: "Defects", exact: true }).click();
  await page.getByRole("button", { name: "Demo checkout total", exact: true }).click();
  await expect(page.getByText("Demo triage confirmed", { exact: true })).toBeVisible();
});
