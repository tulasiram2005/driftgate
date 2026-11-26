import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Isolated UI fixtures; these do not claim a real Jira connection.
test("Jira disconnect requires confirmation and reconnect starts with empty credentials", async ({
  page,
}) => {
  await workspace(page);
  let saved = {
    projectId: "demo-project",
    site: "https://demo.atlassian.net",
    jiraProjectKey: "KAN",
    issueTypeId: "10011",
    revision: 1,
    connected: true,
    updatedAt: new Date().toISOString(),
  };
  let disconnects = 0;
  await page.route("**/api/v1/projects/demo-project/integrations/jira", (route) =>
    route.fulfill({ json: { data: saved, available: true } }),
  );
  await page.route("**/integrations/jira/disconnect", (route) => {
    expect(route.request().postDataJSON()).toEqual({ revision: 1 });
    disconnects++;
    saved = { ...saved, connected: false, revision: 2 };
    return route.fulfill({ json: { data: saved } });
  });
  await page.goto("/");
  await page.getByLabel("Current project").selectOption("demo-project");
  await page.getByRole("button", { name: "Integrations", exact: true }).click();
  await page.getByRole("button", { name: "Disconnect Jira", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "Existing ticket links and QA history stay available",
  );
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(disconnects).toBe(0);
  await page.getByRole("button", { name: "Disconnect Jira", exact: true }).click();
  await page.getByRole("button", { name: "Confirm disconnect" }).click();
  await expect(page.getByText("Jira disconnected. Saved credentials removed.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Check Jira access" })).toHaveCount(0);
  await expect(page.getByLabel("API token")).toHaveValue("");
  await expect(page.getByLabel("Atlassian email")).toHaveValue("");
  expect(disconnects).toBe(1);
});

async function workspace(page: Page, role = "ADMIN") {
  const project = { id: "demo-project", name: "Demo Jira project", role };
  await page.route("**/api/v1/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    const data = path.endsWith("/auth/refresh")
      ? {
          accessToken: "demo-access",
          user: { id: "demo-user", name: "Demo admin", email: "demo@example.test" },
        }
      : path.endsWith("/projects")
        ? [project]
        : path.endsWith("/demo-project")
          ? project
          : [];
    return route.fulfill({ json: { data } });
  });
}

test("Jira settings save, clear credentials, and recover from revision conflicts", async ({
  page,
}, info) => {
  const duplicateKeyWarnings: string[] = [];
  page.on("console", (message) => {
    if (/same key|unique.*key/i.test(message.text())) duplicateKeyWarnings.push(message.text());
  });
  await workspace(page);
  await page.route("**/integrations/jira/verify", (route) =>
    route.fulfill({
      json: {
        data: {
          revision: route.request().postDataJSON().revision,
          checkedAt: "2026-10-24T00:00:00Z",
          status: "ACCESS_CONFIRMED",
        },
      },
    }),
  );
  let saved: Record<string, unknown> | null = null;
  let conflict = false;
  await page.route("**/api/v1/projects/demo-project/integrations/jira", async (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({ json: { data: saved, available: true } });
    const body = route.request().postDataJSON();
    expect(body.token).toBe("demo-token-not-real");
    if (conflict) {
      saved = { ...saved, revision: 2, jiraProjectKey: "NEW" };
      return route.fulfill({
        status: 409,
        json: {
          error: { code: "CONFLICT", message: "Jira settings changed; refresh before saving" },
        },
      });
    }
    expect(body.revision).toBe(0);
    saved = {
      projectId: "demo-project",
      site: body.site,
      jiraProjectKey: body.jiraProjectKey,
      issueTypeId: body.issueTypeId,
      revision: 1,
      updatedAt: new Date().toISOString(),
    };
    return route.fulfill({ json: { data: saved } });
  });
  await page.goto("/");
  await page.getByLabel("Current project").selectOption("demo-project");
  await page.getByRole("button", { name: "Integrations", exact: true }).click();
  await page.getByLabel("Site URL").fill("https://demo.atlassian.net");
  await page.getByLabel("Project key").fill("KAN");
  await page.getByLabel("Issue type ID").fill("10011");
  await page.getByLabel("Atlassian email").fill("demo@example.test");
  await page.getByLabel("API token").fill("demo-token-not-real");
  await page.getByRole("button", { name: "Save settings", exact: true }).click();
  await expect(
    page.getByText("Settings saved. Connection not verified.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "Saved Jira settings" })).toContainText("KAN");
  await expect(page.getByLabel("API token")).toHaveCount(0);
  await page.getByRole("button", { name: "Check Jira access", exact: true }).click();
  await expect(page.getByText(/Jira access confirmed at/)).toBeVisible();
  await page.getByRole("button", { name: "Edit Jira settings" }).click();
  await expect(page.getByLabel("API token")).toHaveValue("");
  await expect(page.getByLabel("Atlassian email")).toHaveValue("");
  await page.getByLabel("API token").fill("discarded-demo-token");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Edit Jira settings" }).click();
  await expect(page.getByLabel("API token")).toHaveValue("");
  conflict = true;
  await page.getByLabel("Atlassian email").fill("demo@example.test");
  await page.getByLabel("API token").fill("demo-token-not-real");
  await page.getByRole("button", { name: "Replace settings" }).click();
  await expect(page.getByLabel("API token")).toHaveValue("");
  await page.getByRole("button", { name: "Reload saved settings" }).click();
  await expect(page.getByRole("region", { name: "Saved Jira settings" })).toContainText("NEW");
  await page.getByRole("button", { name: "Edit Jira settings" }).click();
  await expect(page.getByLabel("Project key")).toHaveValue("NEW");
  await expect(
    page.getByText("Settings saved. Connection not verified.", { exact: true }),
  ).toBeVisible();
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
        path: info.outputPath(`jira-${theme}-${width}.png`),
        fullPage: true,
      });
    }
  }
  expect(duplicateKeyWarnings).toEqual([]);
});

test("Jira form is unavailable without server encryption", async ({ page }) => {
  await workspace(page);
  await page.route("**/integrations/jira", (route) =>
    route.fulfill({ json: { data: null, available: false } }),
  );
  await page.goto("/");
  await page.getByLabel("Current project").selectOption("demo-project");
  await page.getByRole("button", { name: "Integrations", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Jira settings are unavailable" }),
  ).toContainText("server encryption");
  await expect(page.getByLabel("API token")).toHaveCount(0);
});

test("non-admin members cannot open Jira settings", async ({ page }) => {
  await workspace(page, "QA");
  await page.goto("/");
  await page.getByLabel("Current project").selectOption("demo-project");
  await expect(page.getByRole("button", { name: "Integrations", exact: true })).toBeDisabled();
});
