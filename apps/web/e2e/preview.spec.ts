import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

for (const width of [360, 768, 1280, 1920]) {
  test(`responsive themes and accessibility at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator("html")).toHaveCSS("scroll-behavior", "auto");
    await expect(page.locator(".ring-segment").first()).toHaveCSS("opacity", "1");
    for (const theme of ["dark", "light"]) {
      if (theme === "light")
        await page.getByRole("button", { name: "Switch to light theme" }).click();
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      // Let inherited colors repaint before axe snapshots styles in WebKit.
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          ),
      );
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await expect
        .poll(
          async () => {
            const results = await new AxeBuilder({ page })
              .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
              .analyze();
            return results.violations.map(({ id, nodes }) => ({
              id,
              targets: nodes.map(({ target }) => target),
            }));
          },
          { timeout: 5000, message: "The settled theme must pass all WCAG checks" },
        )
        .toEqual([]);
      await page.screenshot({ path: testInfo.outputPath(`${theme}-${width}.png`), fullPage: true });
    }
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  });
}

test("keyboard navigation, filtering and evidence comparison", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();
  const command = page.getByRole("button", { name: "Open command palette" });
  await command.click();
  const dialog = page.getByRole("dialog", { name: "Find a section" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("textbox", { name: "Search sections" }).fill("notfound");
  await expect(dialog.getByRole("status")).toHaveText("No matching sections.");
  await dialog.getByRole("textbox", { name: "Search sections" }).fill("Color");
  await expect(dialog.getByRole("link")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(command).toBeFocused();
  await page.keyboard.press("Control+k");
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Inspect specimen" }).click();
  const evidence = page.getByRole("dialog", { name: "Evidence specimen" });
  await expect(evidence).toBeVisible();
  await evidence.getByRole("slider").fill("75");
  await expect(evidence.getByText("75% staging")).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze())
      .violations,
  ).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Inspect specimen" })).toBeFocused();
  expect(errors).toEqual([]);
});
