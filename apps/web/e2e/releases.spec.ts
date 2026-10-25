import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("real API: release gates persist environment-specific run selection", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const registered = await page.request.post("/api/v1/auth/register", {
    data: {
      name: "Demo release reviewer",
      email: `releases-${randomUUID()}@example.test`,
      password: "Releases-Test-Password!",
    },
  });
  expect(registered.ok()).toBe(true);
  const headers = { Authorization: `Bearer ${(await registered.json()).data.accessToken}` };
  async function post(path: string, data: object) {
    const response = await page.request.post(`/api/v1${path}`, { headers, data });
    expect(response.ok()).toBe(true);
    return (await response.json()).data;
  }
  const project = await post("/projects", { name: "Demo release project" });
  const base = `/projects/${project.id}`;
  const testCase = await post(`${base}/cases`, {
    title: "Demo release check",
    priority: "HIGH",
    type: "MANUAL",
    steps: [{ action: "Review checkout", expected: "Correct total" }],
  });
  const suite = await post(`${base}/suites`, {
    name: "Demo release suite",
    caseIds: [testCase.id],
  });
  const run = await post(`${base}/runs`, {
    suiteId: suite.id,
    environment: "UAT",
    browser: "Chromium",
    device: "Desktop",
  });
  const other = await post(`${base}/runs`, {
    suiteId: suite.id,
    environment: "PROD",
    browser: "Firefox",
    device: "Desktop",
  });
  await page.goto("/");
  await page.getByLabel("Current project").selectOption(project.id);
  await page.getByRole("button", { name: "Releases", exact: true }).click();
  await page.getByRole("button", { name: "New release", exact: true }).click();
  await page.getByLabel("Release name").fill("Demo October release");
  await page.getByRole("button", { name: "Create release", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Demo October release" })).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export release PDF", exact: true }).click();
  expect((await download).suggestedFilename()).toBe("driftgate-release.pdf");
  await page.getByRole("button", { name: "Select runs for UAT" }).click();
  const dialog = page.getByRole("dialog", { name: "UAT runs" });
  await expect(dialog.getByText(other.id, { exact: true })).toHaveCount(0);
  await dialog.getByRole("checkbox", { name: new RegExp(run.id) }).check();
  await dialog.getByRole("button", { name: "Save run selection" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("region", { name: "UAT gate" }).getByText("1 linked runs", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByLabel("Current project").selectOption(project.id);
  await page.getByRole("button", { name: "Releases", exact: true }).click();
  await page.getByRole("button", { name: "Demo October release", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "UAT gate" }).getByText(run.id, { exact: true }),
  ).toBeVisible();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Verify chain and approvals" }).click();
  await expect(page.getByText("Audit chain verified: 0 recorded approvals")).toBeVisible();
  await expect(
    page.getByText("A project member with the Approver role must sign off."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /^Sign off / })).toHaveCount(0);
  for (const width of [360, 768, 1280, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(
      (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze())
        .violations,
    ).toEqual([]);
    await page.screenshot({ path: info.outputPath(`release-${width}.png`), fullPage: true });
  }
  await page.getByRole("button", { name: "Select runs for UAT" }).click();
  await page
    .getByRole("dialog")
    .getByRole("checkbox", { name: new RegExp(run.id) })
    .uncheck();
  await page.getByRole("button", { name: "Save run selection" }).click();
  await expect(
    page.getByRole("region", { name: "UAT gate" }).getByText("0 linked runs", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Overview", exact: true })).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Saved releases" })
      .getByText("Demo October release", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("No open S1 defects. Other release checks may still block approval."),
  ).toBeVisible();
  for (const width of [360, 768, 1280, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(
      (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze())
        .violations,
    ).toEqual([]);
    await page.screenshot({ path: info.outputPath(`overview-${width}.png`), fullPage: true });
  }
  await page.getByRole("button", { name: "Review releases", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Releases", exact: true })).toBeVisible();
});
