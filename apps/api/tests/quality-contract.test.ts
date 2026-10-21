import { expect, test } from "vitest";
import { automatedRunBody, callbackBody } from "../src/execution-contracts.js";

test("quality checks can be requested without changing the existing default suite", () => {
  const base = { environment: "STAGING", matrix: [{ browser: "chromium", device: "desktop" }] };
  expect(automatedRunBody.parse(base).checks).toEqual(["catalogue", "product", "cart"]);
  expect(
    automatedRunBody.parse({ ...base, checks: ["api-contract", "accessibility"] }).checks,
  ).toHaveLength(2);
  expect(automatedRunBody.safeParse({ ...base, checks: ["sql-arbitrary"] }).success).toBe(false);
  expect(
    automatedRunBody.safeParse({ ...base, checks: ["accessibility", "accessibility"] }).success,
  ).toBe(false);
});
test("completion schema bounds the expanded matrix", () => {
  const completed = {
    version: 1,
    eventId: "e49a5001-3b52-4cb4-a720-601d31051f82",
    runId: "quality",
    type: "completed",
    status: "passed",
    resultCount: 30,
  };
  expect(callbackBody.safeParse(completed).success).toBe(true);
  expect(callbackBody.safeParse({ ...completed, resultCount: 46 }).success).toBe(false);
});
