import { expect, test } from "vitest";
import { readConfig } from "../src/config.js";

test("GitHub Actions workflow display name does not override runner dispatch filename", () => {
  const env = {
    DATABASE_URL: "postgresql://unused:unused@127.0.0.1/unused",
    JWT_SECRET: "local-test-only-".repeat(4),
    GITHUB_WORKFLOW: "Quality Gates",
  };
  expect(readConfig(env).RUNNER_GITHUB_WORKFLOW).toBe("runner.yml");
  expect(readConfig({ ...env, RUNNER_GITHUB_WORKFLOW: "custom.yaml" }).RUNNER_GITHUB_WORKFLOW).toBe(
    "custom.yaml",
  );
  expect(() => readConfig({ ...env, RUNNER_GITHUB_WORKFLOW: "../bad.yml" })).toThrow();
});
