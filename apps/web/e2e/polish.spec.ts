import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("real API: primary screens support both themes and preserve an unsaved case", async ({
  page,
}, info) => {
  test.setTimeout(240_000);
  const registered = await page.request.post("/api/v1/auth/register", {
    data: {
      name: "Demo polish reviewer",
      email: `polish-${randomUUID()}@example.test`,
      password: "Demo-Polish-Password!",
    },
  });
  expect(registered.ok()).toBe(true);
  const headers = { Authorization: `Bearer ${(await registered.json()).data.accessToken}` };
  const created = await page.request.post("/api/v1/projects", {
    headers,
    data: { name: "Demo polish project" },
  });
  expect(created.ok()).toBe(true);
  const project = (await created.json()).data;
  const timings: Record<string, number[]> = {};
  for (const endpoint of ["/cases", "/defects/metrics", "/activity", "/releases"]) {
    timings[endpoint] = [];
    for (let sample = 0; sample < 5; sample++) {
      const start = performance.now();
      const response = await page.request.get(`/api/v1/projects/${project.id}${endpoint}`, {
        headers,
      });
      expect(response.ok()).toBe(true);
      await response.body();
      timings[endpoint]!.push(Math.round((performance.now() - start) * 100) / 100);
    }
  }
  await info.attach("workflow-response-times", {
    contentType: "application/json",
    body: JSON.stringify(
      {
        context:
          "Five sequential requests per endpoint, empty demo project, CI-local API via web proxy; not hosted latency or a performance budget.",
        browser: info.project.name,
        milliseconds: timings,
      },
      null,
      2,
    ),
  });
  await page.goto("/");
  await page.getByLabel("Current project").selectOption(project.id);
  await page.getByRole("button", { name: "New case", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "New test case", exact: true });
  await dialog.getByLabel("Title", { exact: true }).fill("Demo unsaved work");
  page.once("dialog", (confirmation) => confirmation.dismiss());
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Title", { exact: true })).toHaveValue("Demo unsaved work");
  page.once("dialog", (confirmation) => confirmation.accept());
  await dialog.getByRole("button", { name: "Close dialog", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("button", { name: "New case", exact: true })).toBeFocused();
  await page.getByRole("searchbox", { name: "Search test cases" }).fill("Demo search");
  await page.getByLabel("Filter priority").selectOption("HIGH");
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await page.getByRole("button", { name: "Test cases", exact: true }).click();
  await expect(page.getByRole("searchbox", { name: "Search test cases" })).toHaveValue(
    "Demo search",
  );
  await expect(page.getByLabel("Filter priority")).toHaveValue("HIGH");
  await page.getByRole("searchbox", { name: "Search test cases" }).fill("");
  await page.getByLabel("Filter priority").selectOption("");
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const theme of ["dark", "light"]) {
    if (theme === "light")
      await page.getByRole("button", { name: "Switch to light theme" }).click();
    for (const screen of [
      "Overview",
      "Requirements",
      "Test cases",
      "Suites",
      "Manual runs",
      "Automated runs",
      "Comparisons",
      "Visual baselines",
      "SQL checks",
      "Defects",
      "Releases",
      "Integrations",
    ]) {
      await page.getByRole("button", { name: screen, exact: true }).click();
      await expect(page.locator("main h1")).toBeVisible();
      await expect(page.locator(".qa-loading")).toHaveCount(0);
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
          path: info.outputPath(`polish-${screen.replaceAll(" ", "-")}-${theme}-${width}.png`),
          fullPage: true,
        });
      }
    }
  }
});
