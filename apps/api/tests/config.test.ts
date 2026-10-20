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

test("API binding is loopback by default and only accepts explicit safe hosts", () => {
  const env = {
    DATABASE_URL: "postgresql://unused:unused@127.0.0.1/unused",
    JWT_SECRET: "local-test-only-".repeat(4),
  };
  expect(readConfig(env).API_BIND_HOST).toBe("127.0.0.1");
  expect(readConfig({ ...env, API_BIND_HOST: "0.0.0.0" }).API_BIND_HOST).toBe("0.0.0.0");
  expect(() => readConfig({ ...env, API_BIND_HOST: "192.168.1.20" })).toThrow();
});
