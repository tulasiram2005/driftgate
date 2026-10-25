import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("overview distinguishes unavailable metrics from zero and recovers independently", async ({
  page,
}) => {
  const project = { id: "demo-overview", name: "Demo overview", role: "DEVELOPER" };
  let metricsCalls = 0;
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
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
  await signals.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(signals.getByRole("alert")).toHaveCount(0);
  await expect(
    signals.getByText("Open S1 defects block release approval. Review these first."),
  ).toBeVisible();
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze())
      .violations,
  ).toEqual([]);
  await page.getByRole("button", { name: "Review defects", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Defects", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "New defect", exact: true })).toHaveCount(0);
});
