import { expect, test } from "@playwright/test";
import { runCheck } from "../../runner/src/catalog";

test("runner detects Threadline seeded broken links without flagging clean staging", async ({
  page,
  baseURL,
}) => {
  test.setTimeout(120000);
  const origin = new URL(baseURL!).origin;
  if (origin !== "http://127.0.0.1:3200") throw new Error("Isolated local demo required");
  const staging = await page.request.get(`${origin}/api/staging/config`);
  expect(staging.ok()).toBe(true);
  await runCheck(page, "broken-links", origin, "staging");
  await expect(runCheck(page, "broken-links", origin, "prod")).rejects.toThrow(
    /Broken or unavailable links/,
  );
});
