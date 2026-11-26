import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function fixture(
  page: Page,
  role = "ADMIN",
  state = "REVIEW_REQUIRED",
  canReconcile = false,
) {
  const project = { id: "demo-project", name: "Demo recovery", role };
  const defect = {
    id: "demo-defect",
    title: "Demo uncertain export",
    severity: "S4",
    status: "NEW",
    revision: 0,
    createdAt: "2026-10-24T00:00:00Z",
    events: [],
    reproduction: {
      environment: "STAGING",
      browser: "Demo",
      device: "Desktop",
      steps: [],
      evidenceIds: [],
      actual: "Demo only",
    },
  };
  let record = {
    canReconcile,
    state,
    site: "https://example.atlassian.net",
    jiraProjectKey: "KAN",
    syncRevision: 0,
    issueKey: null as string | null,
    issueUrl: null as string | null,
    jiraStatusName: null as string | null,
    statusSyncedAt: null as string | null,
  };
  let recoveryCalls = 0;
  const writes: string[] = [];
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() !== "GET" && !path.endsWith("/auth/refresh")) writes.push(path);
    if (path.endsWith("/jira/reconcile")) {
      expect(route.request().postDataJSON()).toEqual({ revision: 0, issueKey: "KAN-2" });
      recoveryCalls++;
      if (recoveryCalls === 1)
        return route.fulfill({
          status: 502,
          json: {
            error: {
              code: "JIRA_INVALID_RESPONSE",
              message:
                "Jira ticket could not be verified for this defect; the export remains unchanged",
            },
          },
        });
      record = {
        ...record,
        state: "LINKED",
        issueKey: "KAN-2",
        issueUrl: "https://example.atlassian.net/browse/KAN-2",
        syncRevision: 1,
        jiraStatusName: "To Do",
        statusSyncedAt: "2026-10-24T00:00:00Z",
      };
      return route.fulfill({ json: { data: record } });
    }
    const data = path.endsWith("/auth/refresh")
      ? {
          accessToken: "demo-access",
          user: { id: "demo-user", name: "Demo user", email: "demo@example.test" },
        }
      : path.endsWith("/projects")
        ? [project]
        : path.endsWith("/demo-project")
          ? project
          : path.endsWith("/jira")
            ? record
            : path.endsWith("/defects/demo-defect")
              ? defect
              : path.endsWith("/defects")
                ? [defect]
                : path.endsWith("/defects/metrics")
                  ? {
                      total: 1,
                      open: 1,
                      closed: 0,
                      openS1: 0,
                      oldestOpenHours: 0,
                      meanResolutionHours: null,
                      resolvedWithHistory: 0,
                    }
                  : [];
    await route.fulfill({ json: { data } });
  });
  await page.goto("/");
  await page.getByLabel("Current project").selectOption(project.id);
  await page.getByRole("button", { name: "Defects", exact: true }).click();
  await page.getByRole("button", { name: defect.title, exact: true }).click();
  return { writes };
}

test("admin recovers an existing ticket after a failed verification without creating another", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const { writes } = await fixture(page);
  await page.getByRole("button", { name: "Link existing Jira ticket" }).click();
  const dialog = page.getByRole("dialog", { name: "Recover Jira link" });
  await expect(dialog).toContainText("https://example.atlassian.net");
  await page.getByLabel("Existing Jira ticket key").fill("KAN-2");
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const theme of ["dark", "light"]) {
    await page.evaluate((value) => {
      document.documentElement.dataset.theme = value;
    }, theme);
    for (const width of [360, 768, 1280, 1920]) {
      await page.setViewportSize({ width, height: 1000 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      expect(
        (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze())
          .violations,
      ).toEqual([]);
      await page.screenshot({
        path: info.outputPath(`jira-recovery-${theme}-${width}.png`),
        fullPage: true,
      });
    }
  }
  await page.getByRole("button", { name: "Verify and link ticket" }).click();
  await expect(dialog.getByRole("alert")).toContainText("export remains unchanged");
  await expect(page.getByRole("link", { name: "KAN-2", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Verify and link ticket" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("link", { name: "KAN-2", exact: true })).toBeVisible();
  await expect(page.getByText("Jira status: To Do", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Next status")).toHaveValue("OPEN");
  expect(writes).toEqual(
    Array(2).fill("/api/v1/projects/demo-project/defects/demo-defect/jira/reconcile"),
  );
});

test("admin can open recovery for server-approved stale pending exports", async ({ page }) => {
  const { writes } = await fixture(page, "ADMIN", "PENDING", true);
  await page.getByRole("button", { name: "Link existing Jira ticket" }).click();
  await expect(page.getByRole("dialog", { name: "Recover Jira link" })).toBeVisible();
  expect(writes).toEqual([]);
});

for (const [role, state] of [
  ["QA", "REVIEW_REQUIRED"],
  ["ADMIN", "PENDING"],
]) {
  test(`recovery hidden for ${role} ${state}`, async ({ page }) => {
    const { writes } = await fixture(page, role, state);
    await expect(page.getByRole("button", { name: "Refresh status", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Link existing Jira ticket" })).toHaveCount(0);
    expect(writes).toEqual([]);
  });
}
