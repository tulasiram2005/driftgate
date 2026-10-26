import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("overview distinguishes unavailable metrics from zero and recovers independently", async ({
  page,
}, info) => {
  test.setTimeout(120_000);
  const project = { id: "demo-overview", name: "Demo overview", role: "DEVELOPER" };
  let metricsCalls = 0;
  let activityCalls = 0;
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/activity")) {
      activityCalls++;
      return activityCalls === 1
        ? route.fulfill({
            status: 503,
            json: { error: { code: "UNAVAILABLE", message: "Demo activity unavailable" } },
          })
        : route.fulfill({ json: { data: [] } });
    }
    if (path.endsWith("/defects/metrics")) {
      metricsCalls++;
      if (metricsCalls === 1)
        return route.fulfill({
          status: 503,
          json: { error: { code: "UNAVAILABLE", message: "Demo metrics unavailable" } },
        });
      return route.fulfill({
        json: {
          data: {
            total: 5,
            open: 3,
            closed: 2,
            openS1: 1,
            oldestOpenHours: 4,
            meanResolutionHours: null,
            resolvedWithHistory: 0,
          },
        },
      });
    }
    const data = path.endsWith("/auth/refresh")
      ? {
          accessToken: "demo-access",
          user: { id: "demo-user", name: "Demo reviewer", email: "demo@example.test" },
        }
      : path.endsWith("/projects")
        ? [project]
        : path.endsWith("/demo-overview")
          ? project
          : [];
    await route.fulfill({ json: { data } });
  });
  await page.goto("/");
  await page.getByLabel("Current project").selectOption(project.id);
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  const signals = page.getByRole("region", { name: "Project quality signals" });
  await expect(signals.getByRole("alert")).toContainText("Demo metrics unavailable");
  await expect(signals.getByText("Open S1 blockers", { exact: true })).toHaveCount(0);
  await expect(page.getByText("No releases yet", { exact: true })).toBeVisible();
  const recent = page.getByRole("region", { name: "Recent activity", exact: true });
  await expect(recent.getByRole("alert")).toContainText("Demo activity unavailable");
  await expect(recent.getByText("No activity yet", { exact: true })).toHaveCount(0);
  await recent.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(recent.getByRole("alert")).toHaveCount(0);
  await expect(recent.getByText("No activity yet", { exact: true })).toBeVisible();
  const retry = signals.getByRole("button", { name: "Retry", exact: true });
  await retry.focus();
  await expect(retry).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(signals.getByRole("alert")).toHaveCount(0);
  await expect(
    signals.getByText("Open S1 defects block release approval. Review these first."),
  ).toBeVisible();
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const theme of ["dark", "light"]) {
    if (theme === "light")
      await page.getByRole("button", { name: "Switch to light theme" }).click();
    for (const width of [360, 768, 1280, 1920]) {
      await page.setViewportSize({ width, height: 1000 });
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
      await page.screenshot({
        path: info.outputPath(`overview-recovery-${theme}-${width}.png`),
        fullPage: true,
      });
    }
  }
  await page.getByRole("button", { name: "Review defects", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Defects", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "New defect", exact: true })).toHaveCount(0);
});
