import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const password = "Phase2-Smoke-Password!";

async function expectAccessible(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  });
  // WebKit can repaint inherited foregrounds one frame after the theme background.
  await expect
    .poll(
      async () =>
        (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze())
          .violations,
      { timeout: 5000, message: "The settled workspace must pass every accessibility rule" },
    )
    .toEqual([]);
}

test("real API: account, projects, versioned cases, CSV, suite and manual results", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  const email = `phase2-${crypto.randomUUID()}@example.test`;
  const projectName = `QA smoke ${crypto.randomUUID().slice(0, 8)}`;
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Sign in to DriftGate." })).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();
  await expectAccessible(page);
  await page.getByRole("button", { name: "Register", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("Phase 2 QA");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Projects", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "New project", exact: true }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Project name").fill(projectName);
  await dialog.getByLabel("Description").fill("Real API smoke test project");
  await dialog.getByRole("button", { name: "Create project", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("heading", { name: "Test cases", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Requirements", exact: true }).click();
  await page.getByRole("button", { name: "New requirement", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Title", { exact: true }).fill("A confirmed order has a receipt");
  await dialog.getByLabel("Description").fill("Confirmation is available after checkout.");
  await dialog.getByRole("button", { name: "Create requirement", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("heading", { name: "A confirmed order has a receipt" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Test cases", exact: true }).click();
  await page.getByRole("button", { name: "New case", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Title", { exact: true }).fill("Checkout confirmation");
  await dialog.getByLabel("Priority", { exact: true }).selectOption("HIGH");
  await dialog.getByLabel("Tags (comma separated)").fill("smoke, checkout");
  await dialog
    .getByLabel("Requirement", { exact: true })
    .selectOption({ label: "A confirmed order has a receipt" });
  await dialog.getByLabel("Action 1", { exact: true }).fill("Complete checkout");
  await dialog.getByLabel("Expected result 1", { exact: true }).fill("The order receipt appears");
  await dialog.getByRole("button", { name: "Add step", exact: true }).click();
  await dialog.getByLabel("Action 2", { exact: true }).fill("Read the order reference");
  await dialog
    .getByLabel("Expected result 2", { exact: true })
    .fill("A unique order reference is visible");
  await expectAccessible(page);
  await dialog.getByRole("button", { name: "Create case", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("cell", { name: "v1", exact: true })).toBeVisible();

  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [360, 768, 1280, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await expectAccessible(page);
    await page.screenshot({ path: testInfo.outputPath(`cases-${width}.png`), fullPage: true });
  }
  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await expectAccessible(page);
  await page.screenshot({ path: testInfo.outputPath("cases-light-1920.png"), fullPage: true });
  await page.getByRole("button", { name: "Switch to dark theme" }).click();

  await page.getByRole("button", { name: "Requirements", exact: true }).click();
  await page.getByRole("button", { name: "Coverage (RTM)", exact: true }).click();
  const matrix = page.getByRole("region", { name: "Requirement traceability matrix" });
  await expect(matrix.getByText("Checkout confirmation", { exact: true })).toBeVisible();
  await expect(matrix.getByText("Covered", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Suites", exact: true }).click();
  await page.getByRole("button", { name: "New suite", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Suite name").fill("Checkout smoke");
  await dialog.getByRole("checkbox", { name: /Checkout confirmation/ }).check();
  await dialog.getByRole("button", { name: "Create suite", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole("button", { name: "Manual runs", exact: true }).click();
  await page.getByRole("button", { name: "Start run", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Suite", { exact: true }).selectOption({ label: "Checkout smoke" });
  await dialog.getByLabel("Environment").selectOption("UAT");
  await dialog.getByLabel("Browser", { exact: true }).fill("Firefox");
  await dialog.getByLabel("Device", { exact: true }).fill("Mobile");
  await dialog.getByRole("button", { name: "Start run", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("heading", { name: "Checkout smoke", exact: true })).toBeVisible();
  for (const status of ["PASS", "FAIL", "BLOCKED", "SKIPPED"] as const) {
    await page.getByLabel("Result", { exact: true }).selectOption(status);
    await page
      .getByLabel("Notes", { exact: true })
      .fill(`Observed ${status} in the real API smoke test`);
    await page.getByRole("button", { name: "Save result", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText("Result saved");
    await expect(
      page.getByRole("navigation", { name: "Run test cases" }).getByText(status, { exact: true }),
    ).toBeVisible();
  }
  for (const width of [360, 768, 1280, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await expectAccessible(page);
    await page.screenshot({ path: testInfo.outputPath(`run-${width}.png`), fullPage: true });
  }

  await page.getByRole("button", { name: "Test cases", exact: true }).click();
  await page.getByRole("button", { name: "Edit: Checkout confirmation", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Title", { exact: true }).fill("Checkout confirmation updated");
  await dialog.getByLabel("Action 1", { exact: true }).fill("Complete checkout with a coupon");
  await dialog.getByRole("button", { name: "Save new version", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("cell", { name: "v2", exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Version history: Checkout confirmation updated", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Version 2", { exact: true }).first()).toBeVisible();
  await dialog.locator("summary").filter({ hasText: "Version 1" }).click();
  await expect(
    dialog.getByRole("heading", { name: "Checkout confirmation", exact: true }),
  ).toBeVisible();
  await expect(dialog.getByText("Complete checkout", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", {
      name: "Version history: Checkout confirmation updated",
      exact: true,
    }),
  ).toBeFocused();

  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV", exact: true }).click();
  const download = await downloadEvent;
  const downloadPath = testInfo.outputPath("test-cases.csv");
  await download.saveAs(downloadPath);
  const csv = await readFile(downloadPath, "utf8");
  expect(csv).toContain("Checkout confirmation updated");
  await page.getByRole("button", { name: "Projects", exact: true }).click();
  await page.getByRole("button", { name: "New project", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Project name").fill(`${projectName} import`);
  await dialog.getByRole("button", { name: "Create project", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByLabel("Current project").selectOption({ label: projectName });
  await page.getByRole("button", { name: "Import CSV", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("CSV content").fill(csv);
  await dialog.getByRole("button", { name: "Import cases", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Delete: Checkout confirmation updated", exact: true }),
  ).toHaveCount(2);
  await page
    .getByRole("button", { name: "Delete: Checkout confirmation updated", exact: true })
    .last()
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Delete: Checkout confirmation updated", exact: true }),
  ).toHaveCount(2);
  await page
    .getByRole("button", { name: "Delete: Checkout confirmation updated", exact: true })
    .last()
    .click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete case", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Delete: Checkout confirmation updated", exact: true }),
  ).toHaveCount(1);

  await page.reload();
  await expect(page.getByRole("heading", { name: "Projects", exact: true })).toBeVisible();
  await page.getByLabel("Current project").selectOption({ label: projectName });
  await page.getByRole("button", { name: "Manual runs", exact: true }).click();
  await page.getByRole("button", { name: "Open run", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Checkout confirmation", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Complete checkout", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Result", { exact: true })).toHaveValue("SKIPPED");
  await expect(page.getByLabel("Notes", { exact: true })).toHaveValue(
    "Observed SKIPPED in the real API smoke test",
  );
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual(["driftgate-theme"]);
  expect(await page.evaluate(() => sessionStorage.length)).toBe(0);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Sign in to DriftGate." })).toBeVisible();
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.locator("form").getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Projects", exact: true })).toBeVisible();
  expect(browserErrors).toEqual([]);
});

test("real API: project membership controls QA writes and read-only roles", async ({
  page,
  browser,
}) => {
  test.setTimeout(120_000);
  const suffix = crypto.randomUUID();
  const owner = await page.request.post("/api/v1/auth/register", {
    data: { name: "Role test admin", email: `owner-${suffix}@example.test`, password },
  });
  expect(owner.ok()).toBe(true);
  const { data: ownerSession } = await owner.json();
  const headers = { Authorization: `Bearer ${ownerSession.accessToken}` };
  const projectResponse = await page.request.post("/api/v1/projects", {
    headers,
    data: { name: `Roles ${suffix}` },
  });
  expect(projectResponse.ok()).toBe(true);
  const { data: project } = await projectResponse.json();
  const memberContext = await browser.newContext();
  const memberEmail = `member-${suffix}@example.test`;
  try {
    const member = await memberContext.request.post(
      `${test.info().project.use.baseURL}/api/v1/auth/register`,
      { data: { name: "Role test member", email: memberEmail, password } },
    );
    expect(member.ok()).toBe(true);
    const memberPage = await memberContext.newPage();
    for (const role of ["QA", "DEVELOPER", "APPROVER"] as const) {
      const response = await page.request.post(`/api/v1/projects/${project.id}/members`, {
        headers,
        data: { email: memberEmail, role },
      });
      expect(response.ok()).toBe(true);
      await memberPage.goto(test.info().project.use.baseURL!);
      await expect(
        memberPage.getByRole("heading", { name: "Projects", exact: true }),
      ).toBeVisible();
      await memberPage.getByLabel("Current project").selectOption(project.id);
      await expect(
        memberPage.getByRole("heading", { name: "Test cases", exact: true }),
      ).toBeVisible();
      if (role === "QA")
        await expect(
          memberPage.getByRole("button", { name: "New case", exact: true }),
        ).toBeVisible();
      else
        await expect(memberPage.getByRole("button", { name: "New case", exact: true })).toHaveCount(
          0,
        );
      await expect(memberPage.getByRole("button", { name: "Add member", exact: true })).toHaveCount(
        0,
      );
      await memberPage.getByRole("button", { name: "Manual runs", exact: true }).click();
      if (role === "QA")
        await expect(
          memberPage.getByRole("button", { name: "Start run", exact: true }),
        ).toBeVisible();
      else
        await expect(
          memberPage.getByRole("button", { name: "Start run", exact: true }),
        ).toHaveCount(0);
    }
  } finally {
    await memberContext.close();
  }
});
